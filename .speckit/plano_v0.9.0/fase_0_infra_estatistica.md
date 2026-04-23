# Fase 0 — Infraestrutura Estatística

> **Objetivo:** tabela de referência `role_stat_refs` com média, stddev e percentis por role/stat/patch. Base pra toda normalização real das fases seguintes.
>
> **Pré-requisitos:** nenhum.
> **Custo estimado:** 1 dia.
> **Bloqueia:** Fases 1, 2, 6.
> **Status:** Não iniciado.

---

## Decisões de design (antes de começar)

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Nível de agregação | `(role, stat_name, patch)` | Stats mudam entre patches; agregar só por role perde resolução temporal |
| Incluir elo? | Não nessa fase | Não temos `tier` por match no schema atual. Adicionar quando tivermos (roadmap) |
| Percentis usados | 25/50/75/95 | P95 pra identificar "top da role"; p25/75 pra IQR; p50 = mediana |
| Sample size mínimo por bucket | 30 matches | Abaixo disso, avg/stddev são ruído — skip com warning |
| Storage | Tabela no Supabase | Permite cache em memória no serviço + consulta via MCP se precisar debugar |
| Refresh | GitHub Action 1×/semana | Patch novo sai ~2/semana; 1×/sem é suficiente |
| Substituir `challenges` JSONB? | Não | Stats vêm de colunas diretas já; `challenges` é legado |

---

## Steps

### Step 0.1 — Fixar lista de stats

**Inputs:** schema de `match_participants`.
**Output:** constante `ROLE_STAT_FIELDS` no serviço.
**Bibliotecas:** nenhuma.

Lista final (15 stats):

```python
# backend/services/stats_refs.py (novo arquivo)

ROLE_STAT_FIELDS: list[str] = [
    "kills",
    "deaths",
    "assists",
    "total_cs",
    "cs_per_minute",
    "gold_earned",
    "gold_per_minute",
    "damage_per_minute",
    "total_damage_dealt_to_champions",
    "total_damage_taken",
    "vision_score",
    "kill_participation",
    "damage_dealt_to_buildings",
    "solo_kills",
    "early_laning_phase_gold_exp_advantage",
]
```

**Validação:** rodar `mcp__Supabase__list_tables` filtrando `match_participants` e confirmar que todas as 15 colunas existem. Se alguma não existir, paramos e discutimos.

---

### Step 0.2 — Criar migration `003_create_role_stat_refs.sql`

**Inputs:** Step 0.1.
**Output:** arquivo `database/migrations/003_create_role_stat_refs.sql`.

```sql
-- Migration 003 — Tabela role_stat_refs (Fase 0 do plano v0.9.0)
--
-- Média, stddev e percentis por role/stat/patch. Alimenta a normalização
-- real do perfil 8D (Fase 1) e tudo que vem depois.
--
-- Refresh via scripts/processing/refresh_role_stat_refs.py, rodado semanalmente.

CREATE TABLE IF NOT EXISTS role_stat_refs (
  role         TEXT NOT NULL,
  stat_name    TEXT NOT NULL,
  patch        TEXT NOT NULL,
  avg          DOUBLE PRECISION NOT NULL,
  stddev       DOUBLE PRECISION NOT NULL,
  p25          DOUBLE PRECISION NOT NULL,
  p50          DOUBLE PRECISION NOT NULL,
  p75          DOUBLE PRECISION NOT NULL,
  p95          DOUBLE PRECISION NOT NULL,
  sample_size  INTEGER NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role, stat_name, patch)
);

COMMENT ON TABLE role_stat_refs IS
  'Referência estatística por role/stat/patch. Alimenta normalização do perfil 8D.';

CREATE INDEX IF NOT EXISTS role_stat_refs_patch_idx
  ON role_stat_refs (patch);

ALTER TABLE role_stat_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_stat_refs_select_public" ON role_stat_refs;
CREATE POLICY "role_stat_refs_select_public"
  ON role_stat_refs
  FOR SELECT
  TO public
  USING (true);
-- Writes ficam só no service_role (bypass RLS).
```

**Validação:** query validação depois de aplicar:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'role_stat_refs' ORDER BY ordinal_position;
```
Deve retornar 11 colunas.

---

### Step 0.3 — Aplicar migration via MCP Supabase

**Inputs:** Step 0.2.
**Output:** tabela criada no Supabase.

Execução:
```
mcp__claude_ai_Supabase__apply_migration(
  project_id="ebwplwizjsevhcowyfhg",
  name="create_role_stat_refs",
  query=<conteúdo do SQL acima>
)
```

**Validação:**
1. `mcp__Supabase__list_tables` inclui `role_stat_refs`
2. `mcp__Supabase__execute_sql("SELECT * FROM pg_policies WHERE tablename='role_stat_refs'")` retorna a policy `role_stat_refs_select_public`
3. Índice `role_stat_refs_patch_idx` existe

---

### Step 0.4 — Escrever script `refresh_role_stat_refs.py`

**Inputs:** Step 0.1, 0.3.
**Output:** `scripts/processing/refresh_role_stat_refs.py`.
**Bibliotecas:**
- `polars` — group_by + quantile em batch
- `supabase-py` — upsert final
- `python-dotenv` — env
- `httpx` (já vem com supabase-py)

**Estrutura do script:**

```python
"""
refresh_role_stat_refs.py — recalcula a tabela role_stat_refs.

Uso:
    python -m scripts.processing.refresh_role_stat_refs
    python -m scripts.processing.refresh_role_stat_refs --patch 16.7   # só um patch
    python -m scripts.processing.refresh_role_stat_refs --min-sample 50

Roda 1×/semana via GitHub Action. Demora ~30s–2min dependendo do volume.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Any

import polars as pl
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("refresh_role_stat_refs")

# ── Config
ROLE_STAT_FIELDS: list[str] = [
    "kills", "deaths", "assists",
    "total_cs", "cs_per_minute",
    "gold_earned", "gold_per_minute",
    "damage_per_minute", "total_damage_dealt_to_champions", "total_damage_taken",
    "vision_score", "kill_participation",
    "damage_dealt_to_buildings",
    "solo_kills",
    "early_laning_phase_gold_exp_advantage",
]

VALID_ROLES = {"TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"}
DEFAULT_MIN_SAMPLE = 30
PAGE_SIZE = 1000  # Supabase default


def fetch_participants(db, patch: str | None = None) -> pl.DataFrame:
    """Lê match_participants em páginas, junta com matches pra pegar game_version."""
    rows: list[dict] = []
    offset = 0

    select_cols = ",".join(ROLE_STAT_FIELDS + ["team_position", "matches(game_version)"])

    while True:
        q = db.table("match_participants").select(select_cols).range(offset, offset + PAGE_SIZE - 1)
        page = q.execute().data or []
        if not page:
            break
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    logger.info(f"Fetch total: {len(rows)} participantes")

    # Achata matches.game_version → game_version, filtra role válida
    flat = []
    for r in rows:
        m = r.get("matches") or {}
        role = r.get("team_position", "")
        if role not in VALID_ROLES:
            continue
        gv = m.get("game_version", "")
        if not gv:
            continue
        if patch and gv != patch:
            continue
        row = {"role": role, "patch": gv}
        for f in ROLE_STAT_FIELDS:
            row[f] = r.get(f)
        flat.append(row)

    return pl.DataFrame(flat)


def compute_refs(df: pl.DataFrame, min_sample: int) -> list[dict[str, Any]]:
    """Agrupa por (role, patch), calcula stats pra cada campo."""
    out = []
    for (role, patch), group in df.group_by(["role", "patch"]):
        n = group.height
        if n < min_sample:
            logger.warning(f"Skip {role}/{patch}: só {n} partidas")
            continue
        for stat in ROLE_STAT_FIELDS:
            col = group[stat].cast(pl.Float64, strict=False).drop_nulls()
            if col.len() < min_sample:
                continue
            out.append({
                "role": role,
                "stat_name": stat,
                "patch": patch,
                "avg":    float(col.mean() or 0),
                "stddev": float(col.std() or 0),
                "p25":    float(col.quantile(0.25) or 0),
                "p50":    float(col.quantile(0.50) or 0),
                "p75":    float(col.quantile(0.75) or 0),
                "p95":    float(col.quantile(0.95) or 0),
                "sample_size": int(col.len()),
            })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--patch", help="Processa só esse patch")
    ap.add_argument("--min-sample", type=int, default=DEFAULT_MIN_SAMPLE)
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL e SUPABASE_KEY são obrigatórios")
        return 1

    db = create_client(url, key)

    df = fetch_participants(db, patch=args.patch)
    if df.is_empty():
        logger.error("Nenhum participante pra processar")
        return 1

    logger.info(f"{df.height} rows válidos após filtros")
    logger.info(f"Patches encontrados: {sorted(df['patch'].unique().to_list())}")

    refs = compute_refs(df, min_sample=args.min_sample)
    logger.info(f"{len(refs)} rows de referência calculadas")

    if not refs:
        logger.warning("Nada a upsert")
        return 0

    # Upsert em batches de 100
    for i in range(0, len(refs), 100):
        batch = refs[i:i + 100]
        db.table("role_stat_refs").upsert(batch, on_conflict="role,stat_name,patch").execute()
        logger.info(f"  upsert {i + len(batch)}/{len(refs)}")

    logger.info("✓ Completo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

### Step 0.5 — Primeiro run + validação manual

**Comando:**
```bash
cd c:/Users/cesar/Documents/GitHub/Metis
./.venv/Scripts/python.exe -m scripts.processing.refresh_role_stat_refs
```

**Validações obrigatórias** (via MCP Supabase `execute_sql`):

```sql
-- 1) Volume esperado: 5 roles × 15 stats × N patches
SELECT patch, count(*) as rows FROM role_stat_refs GROUP BY patch ORDER BY patch DESC;
-- Esperado: uns 75 rows por patch recente (se todas as stats têm dados)

-- 2) Sanity check — ordem das roles por CS/m
SELECT role, avg, sample_size
FROM role_stat_refs
WHERE stat_name = 'cs_per_minute' AND patch = (SELECT MAX(patch) FROM role_stat_refs)
ORDER BY avg DESC;
-- Esperado: BOTTOM > MIDDLE > TOP > JUNGLE > UTILITY

-- 3) Sanity check — KP por role (Sup é o maior)
SELECT role, avg, sample_size
FROM role_stat_refs
WHERE stat_name = 'kill_participation' AND patch = (SELECT MAX(patch) FROM role_stat_refs)
ORDER BY avg DESC;
-- Esperado: UTILITY tem KP alto, próximo de JUNGLE

-- 4) Sanity check — visão é rei no Sup
SELECT role, avg FROM role_stat_refs
WHERE stat_name = 'vision_score' AND patch = (SELECT MAX(patch) FROM role_stat_refs)
ORDER BY avg DESC;
-- Esperado: UTILITY >> JUNGLE >> TOP ~ MIDDLE ~ BOTTOM
```

**Se alguma sanity check falhar:** PARAR. Investigar — pode ser:
- Filtro de role mal feito (está pegando UNKNOWN?)
- Bug no parse de `game_version`
- Stats com null demais

---

### Step 0.6 — (Opcional) Endpoint de debug

**Inputs:** tabela populada.
**Output:** endpoint `GET /api/v1/stats/role-refs`.
**Decisão:** se não há necessidade imediata, pular. O Supabase MCP já permite consulta direta pra debug.

**Código se vier a ser necessário:**
```python
# backend/api/routes/stats.py — adicionar:

@router.get("/role-refs")
def get_role_refs(
    role: str | None = Query(default=None),
    patch: str | None = Query(default=None),
):
    db = _get_supabase()
    q = db.table("role_stat_refs").select("*")
    if role:  q = q.eq("role", role.upper())
    if patch: q = q.eq("patch", patch)
    return q.execute().data or []
```

---

### Step 0.7 — GitHub Action semanal

**Output:** `.github/workflows/refresh_role_stat_refs.yml`.

```yaml
name: Refresh Role Stat Refs

on:
  schedule:
    - cron: "0 4 * * 0"   # domingo 04:00 UTC
  workflow_dispatch:       # permite trigger manual

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install deps
        run: |
          pip install polars supabase python-dotenv httpx

      - name: Run refresh
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python -m scripts.processing.refresh_role_stat_refs
```

**Validação:** trigger manual (`workflow_dispatch`) funciona e loga `✓ Completo` no fim. Só depois deixa o cron assumir.

---

## Critério de "done" da Fase 0

- [ ] Migration `003_create_role_stat_refs.sql` aplicada (via MCP, confirmada em `list_tables`)
- [ ] Script `refresh_role_stat_refs.py` roda local sem erro
- [ ] Tabela tem ~75 rows por patch ativo
- [ ] 4 sanity checks SQL passam
- [ ] GitHub Action criada, trigger manual passa
- [ ] Patch notes atualizado com entrada "p-0.10.0-alpha.0 — Infraestrutura Estatística"

---

## Rollback

Se algo der ruim depois de aplicar:

```sql
-- Rollback: drop da tabela
DROP TABLE IF EXISTS role_stat_refs CASCADE;
```

Nada mais consome ela ainda (Fase 1 não começou). Rollback é seguro e imediato.

---

## Patch notes sugerido (pra quando fechar)

```markdown
## p-0.10.0-alpha.0 — Fase 0: Infraestrutura Estatística (YYYY-MM-DD)

Fundação do sistema Neo-Artemis 2.0. Não muda nada visível ainda — prepara terreno pra Fase 1.

### Database
- **Nova tabela `role_stat_refs`** (role, stat_name, patch) com avg, stddev, p25/50/75/95 e sample_size
- RLS: leitura pública, write service_role
- Índice em patch

### Scripts
- `scripts/processing/refresh_role_stat_refs.py` — agrega `match_participants` em batch via polars
- 15 stats relevantes definidas em constante

### CI/CD
- GitHub Action semanal (domingo 04:00 UTC) pra refresh automático

### Verificação
- Sanity checks validados: CS/m por role (ADC > MID > TOP > JG > SUP), KP (SUP alto), vision (SUP >> rest)
```

---

## Re-aval antes de começar

Antes de qualquer step aqui, reconfirmo contigo:
1. Lista de 15 stats está boa?
2. `patch` como string literal do `game_version` está ok? (ex: `"16.7.1"` — sem parse de versão)
3. `min_sample=30` é razoável ou muito alto/baixo?

Se responder sim, arranco pelo Step 0.1.
