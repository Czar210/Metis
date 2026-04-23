# Fase 4 — Classes de Campeões + Enemy Comp

> **Objetivo:** ter taxonomia semântica de campeões (10 classes curadas manualmente por César) e calcular a composição do time inimigo em cada match — pré-requisito pra Fase 5 (build contextual).
>
> **Pré-requisitos:** CSV de classificação do César 100% preenchido (trabalho em paralelo).
> **Custo estimado:** 2–3 dias de dev + tempo de curadoria do César em paralelo.
> **Bloqueia:** Fase 5.
> **Status:** Curadoria em andamento (CSV gerado, César preenche). Dev não iniciado.

---

## Decisões de design

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Fonte das classes | CSV curado manualmente → tabela `champions` | Mais confiável que tags DDragon; César gasta ~4h pra cobrir 172 champs |
| Formato de `classes` no banco | JSONB array (`["assassin", "skirmisher"]`) | Champs versáteis (Kayn) têm 2–3 classes |
| `primary_class` separado? | Sim, coluna TEXT | Filtro/agrupamento rápido sem precisar JSONB query |
| Arquétipos de comp (next phase) | 5 itens pra classificação | Compatível com 5 jogadores por time |
| Storage de comp em matches | 2 JSONB columns: `blue_comp_archetypes`, `red_comp_archetypes` | Formato `{"tank":2,"bruiser":1,...}` denso |
| Backfill de comp | Sim, script idempotente | Matches antigas precisam dessa info pra Fase 5 funcionar |

---

## Steps

### Step 4.1 — Revisão do CSV de classificação do César

**Input:** `data/champion_classification.csv` preenchido.
**Validação:**
- Todas as 172 linhas têm `primary_class` não vazio
- `primary_class` é um dos 10 válidos
- `secondary_classes` vazio ou lista separada por `|` com classes válidas

**Comando de validação:**
```python
# scripts/processing/validate_champion_csv.py
import csv
VALID = {"tank","bruiser","juggernaut","skirmisher","assassin",
         "burst_mage","control_mage","marksman","enchanter","catcher"}

with open("data/champion_classification.csv") as f:
    errors = []
    for row in csv.DictReader(f):
        if not row["primary_class"]:
            errors.append(f"{row['champion_name']}: primary_class vazio")
        elif row["primary_class"] not in VALID:
            errors.append(f"{row['champion_name']}: primary inválido '{row['primary_class']}'")
        for sec in (row["secondary_classes"] or "").split("|"):
            if sec and sec not in VALID:
                errors.append(f"{row['champion_name']}: secondary inválido '{sec}'")

if errors:
    print("\n".join(errors[:20]))
    exit(1)
print("✓ CSV válido")
```

Rodar isso antes de qualquer coisa. Se tiver erro, voltar pro CSV.

---

### Step 4.2 — Migration `005_create_champions_table.sql`

```sql
-- Migration 005 — Tabela champions (Fase 4)
--
-- Classes curadas manualmente por César. Alimenta análise de composição
-- inimiga (Fase 4) e build contextual (Fase 5).

CREATE TABLE IF NOT EXISTS champions (
  champion_name   TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  title           TEXT,
  ddragon_tags    JSONB NOT NULL DEFAULT '[]'::jsonb,
  classes         JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_class   TEXT,
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS champions_primary_class_idx
  ON champions (primary_class)
  WHERE primary_class IS NOT NULL;

CREATE INDEX IF NOT EXISTS champions_classes_gin_idx
  ON champions USING GIN (classes);

ALTER TABLE champions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "champions_select_public" ON champions;
CREATE POLICY "champions_select_public"
  ON champions FOR SELECT TO public USING (true);

COMMENT ON TABLE champions IS
  'Catálogo de campeões com classes curadas. primary_class + classes[] preenchidos manualmente.';
```

Aplicar via MCP.

---

### Step 4.3 — Script `sync_champions.py`

**Output:** `scripts/processing/sync_champions.py`.
**Bibliotecas:** `csv` stdlib, `supabase-py`, `python-dotenv`.

```python
"""
sync_champions.py — popula tabela `champions` a partir do CSV curado.

Lê data/champion_classification.csv e faz upsert. Preserva campos manuais
(primary_class, classes, notes) em runs subsequentes graças ao on_conflict.

Uso:
    python -m scripts.processing.sync_champions
"""

from __future__ import annotations
import csv
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sync_champions")

CSV_PATH = Path(__file__).parents[2] / "data" / "champion_classification.csv"

VALID_CLASSES = {
    "tank","bruiser","juggernaut","skirmisher","assassin",
    "burst_mage","control_mage","marksman","enchanter","catcher",
}


def load_csv() -> list[dict]:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV não existe em {CSV_PATH}")

    rows = []
    with CSV_PATH.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            # Parse tags
            tags = [t.strip() for t in (r.get("ddragon_tags") or "").split("|") if t.strip()]
            # Parse classes
            sec = [c.strip() for c in (r.get("secondary_classes") or "").split("|") if c.strip()]
            primary = (r.get("primary_class") or "").strip() or None
            classes = [primary] + sec if primary else sec
            classes = [c for c in classes if c in VALID_CLASSES]

            rows.append({
                "champion_name":  r["champion_name"],
                "display_name":   r.get("display_name") or r["champion_name"],
                "title":          r.get("title") or None,
                "ddragon_tags":   tags,
                "classes":        classes,
                "primary_class":  primary if primary in VALID_CLASSES else None,
                "notes":          r.get("notes") or None,
            })
    return rows


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL e SUPABASE_KEY obrigatórios")
        return 1

    rows = load_csv()
    unclassified = sum(1 for r in rows if not r["primary_class"])
    logger.info(f"{len(rows)} champions lidos; {unclassified} sem primary_class")

    if unclassified > 0:
        logger.warning(f"Atenção: {unclassified} champions sem classificação — checa o CSV")

    db = create_client(url, key)
    for i in range(0, len(rows), 100):
        batch = rows[i:i+100]
        db.table("champions").upsert(batch, on_conflict="champion_name").execute()
        logger.info(f"  upsert {i+len(batch)}/{len(rows)}")

    logger.info("✓ Completo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Comando:**
```bash
./.venv/Scripts/python.exe -m scripts.processing.sync_champions
```

**Validação:**
```sql
SELECT primary_class, count(*) FROM champions GROUP BY primary_class ORDER BY 2 DESC;
-- Esperado: distribuição razoável — nenhum bucket vazio
```

---

### Step 4.4 — Migration `006_add_comp_archetypes_to_matches.sql`

```sql
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS blue_comp_archetypes JSONB,
  ADD COLUMN IF NOT EXISTS red_comp_archetypes  JSONB;

-- Nenhum índice por ora — queries futuras vão filtrar por primary_class
-- já agregado via função, não por GIN na coluna.
```

Aplicar via MCP.

---

### Step 4.5 — Função `compute_comp_archetypes(team_champions, champ_class_map)`

**Output:** função Python em `backend/services/comp_service.py` (novo).

```python
"""
comp_service.py — utilidades de composição de time.
"""

from __future__ import annotations
from collections import defaultdict


def compute_comp_archetypes(
    team_champion_names: list[str],
    champ_class_map: dict[str, str | None],
) -> dict[str, int]:
    """
    Retorna {classe: contagem}. Champs sem classe viram "unclassified".

    Exemplo:
        compute_comp_archetypes(
            ["Ornn", "Vi", "Orianna", "Jinx", "Thresh"],
            {"Ornn": "tank", "Vi": "bruiser", "Orianna": "control_mage",
             "Jinx": "marksman", "Thresh": "catcher"}
        )
        → {"tank": 1, "bruiser": 1, "control_mage": 1, "marksman": 1, "catcher": 1}
    """
    counts: dict[str, int] = defaultdict(int)
    for name in team_champion_names:
        cls = champ_class_map.get(name) or "unclassified"
        counts[cls] += 1
    return dict(counts)


def load_champion_class_map(db_client) -> dict[str, str | None]:
    """Carrega {champion_name: primary_class} do banco. Cache externo se precisar."""
    rows = db_client.table("champions").select("champion_name, primary_class").execute().data or []
    return {r["champion_name"]: r.get("primary_class") for r in rows}
```

**Testes** (`tests/test_comp_service.py`):
```python
def test_basic_comp():
    result = compute_comp_archetypes(
        ["Ornn", "Vi", "Orianna", "Jinx", "Thresh"],
        {"Ornn":"tank","Vi":"bruiser","Orianna":"control_mage","Jinx":"marksman","Thresh":"catcher"},
    )
    assert result == {"tank":1,"bruiser":1,"control_mage":1,"marksman":1,"catcher":1}

def test_unclassified():
    result = compute_comp_archetypes(["Aatrox"], {})
    assert result == {"unclassified": 1}

def test_duplicates():
    result = compute_comp_archetypes(
        ["Ornn", "Maokai"], {"Ornn":"tank","Maokai":"tank"}
    )
    assert result == {"tank": 2}
```

---

### Step 4.6 — Script `backfill_comp_archetypes.py`

**Output:** `scripts/processing/backfill_comp_archetypes.py`.
**Bibliotecas:** `polars`, `supabase-py`.

```python
"""
backfill_comp_archetypes.py — popula blue/red_comp_archetypes em matches existentes.

Idempotente: só mexe em matches com os campos NULL.

Uso:
    python -m scripts.processing.backfill_comp_archetypes
    python -m scripts.processing.backfill_comp_archetypes --force   # re-processa tudo
"""

import argparse
import logging
import os
import sys
from collections import defaultdict

from dotenv import load_dotenv
from supabase import create_client
from backend.services.comp_service import compute_comp_archetypes, load_champion_class_map

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_comp")

PAGE_SIZE = 500


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="Re-processa mesmo matches já populadas")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL e SUPABASE_KEY obrigatórios")
        return 1

    db = create_client(url, key)
    class_map = load_champion_class_map(db)
    logger.info(f"{len(class_map)} champions carregados")

    # 1) Lista matches que precisam ser processadas
    q = db.table("matches").select("match_id")
    if not args.force:
        q = q.is_("blue_comp_archetypes", "null")
    match_ids = [r["match_id"] for r in (q.execute().data or [])]
    logger.info(f"{len(match_ids)} matches pra processar")

    # 2) Processa em batches
    for i in range(0, len(match_ids), PAGE_SIZE):
        batch_ids = match_ids[i:i+PAGE_SIZE]

        participants = (
            db.table("match_participants")
            .select("match_id, champion_name, team_id")
            .in_("match_id", batch_ids)
            .execute()
            .data or []
        )

        by_match: dict[str, dict[int, list[str]]] = defaultdict(lambda: defaultdict(list))
        for p in participants:
            by_match[p["match_id"]][p["team_id"]].append(p["champion_name"])

        updates = []
        for mid, teams in by_match.items():
            blue_champs = teams.get(100, [])
            red_champs = teams.get(200, [])
            if len(blue_champs) != 5 or len(red_champs) != 5:
                continue  # partida incompleta
            updates.append({
                "match_id": mid,
                "blue_comp_archetypes": compute_comp_archetypes(blue_champs, class_map),
                "red_comp_archetypes":  compute_comp_archetypes(red_champs, class_map),
            })

        for u in updates:
            db.table("matches").update(
                {"blue_comp_archetypes": u["blue_comp_archetypes"],
                 "red_comp_archetypes":  u["red_comp_archetypes"]}
            ).eq("match_id", u["match_id"]).execute()

        logger.info(f"  {i+len(batch_ids)}/{len(match_ids)}: {len(updates)} matches atualizadas")

    logger.info("✓ Completo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Tempo estimado:** depende do volume. Pra ~20k matches, ~10-20 min com os updates em loop. Pode otimizar com upsert batch se doer.

---

### Step 4.7 — Integrar na ETL de matches novas

**Mudança em `backend/services/riot_service.py`:** dentro de `_processar_e_salvar` após inserir a match e os participantes, calcular e atualizar os 2 campos.

```python
# Após inserir participants com sucesso:
from backend.services.comp_service import compute_comp_archetypes, load_champion_class_map

# _class_map_cache = {}  # cache de módulo, refresh N×/dia
if not _class_map_cache:
    _class_map_cache.update(load_champion_class_map(self.supabase))

blue_champs = [p["champion_name"] for p in participants if p["team_id"] == 100]
red_champs = [p["champion_name"] for p in participants if p["team_id"] == 200]

blue_arch = compute_comp_archetypes(blue_champs, _class_map_cache)
red_arch = compute_comp_archetypes(red_champs, _class_map_cache)

self.supabase.table("matches").update({
    "blue_comp_archetypes": blue_arch,
    "red_comp_archetypes":  red_arch,
}).eq("match_id", match_id).execute()
```

---

### Step 4.8 — Validação final

```sql
-- 1) Champs classificados
SELECT count(*) FROM champions WHERE primary_class IS NOT NULL;
-- Esperado: 170+ (deixando margem pra 1-2 não classificados temporariamente)

-- 2) Matches com archetype
SELECT count(*) FROM matches WHERE blue_comp_archetypes IS NOT NULL;
-- Esperado: todas ou perto disso

-- 3) Sanity check — match específica
SELECT match_id, blue_comp_archetypes, red_comp_archetypes FROM matches LIMIT 5;
-- Inspecionar: soma dos valores de cada comp deve ser 5

-- 4) Distribuição de arquétipos comuns
SELECT
  blue_comp_archetypes->>'tank' as tanks,
  count(*) as n
FROM matches
WHERE blue_comp_archetypes IS NOT NULL
GROUP BY 1 ORDER BY 1;
-- Esperado: distribuição em U — muitas matches com 0 ou 1 tank, poucas com 3+
```

---

## Critério de "done" da Fase 4

- [ ] CSV do César validado (script de validação retorna OK)
- [ ] Migration 005 aplicada, `champions` populada via `sync_champions.py`
- [ ] Migration 006 aplicada, `matches.blue/red_comp_archetypes` existem
- [ ] `comp_service.py` com testes
- [ ] Backfill rodou — 95%+ das matches têm archetype
- [ ] ETL de matches novas popula automaticamente (validar com uma sync de player)
- [ ] Distribuição de archetypes passa sanity checks
- [ ] Patch notes

---

## Rollback

- Dropar colunas `blue_comp_archetypes`, `red_comp_archetypes` de `matches` (seguro, ninguém consome ainda)
- `champions` fica populada — só precisa até Fase 5

---

## Patch notes sugerido

```markdown
## p-0.10.0-alpha.5 — Fase 4: Classes + Enemy Comp (YYYY-MM-DD)

Taxonomia semântica de champs + composição inimiga por match — destrava Fase 5.

### Curadoria
- 172 champions classificados manualmente em 10 classes (César, ~4h)

### Database
- Nova tabela `champions` com `primary_class`, `classes[]`, `ddragon_tags`
- 2 colunas novas em `matches`: `blue_comp_archetypes`, `red_comp_archetypes`

### Backend
- `comp_service.py` com `compute_comp_archetypes()` + cache de class map
- ETL de matches novas popula arquétipo automaticamente
- Backfill de N matches antigas rodado
```
