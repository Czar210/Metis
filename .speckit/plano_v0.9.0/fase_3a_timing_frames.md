# Fase 3a — Timing via Frames

> **Objetivo:** extrair métricas de timing do jogador a partir dos **frames** da timeline (gold/CS/XP por minuto, que já temos). Nova tabela `player_timing_profile` + expansão do perfil de 8D pra **10D** (+ `Scaling` + `Early Pressure`).
>
> **Pré-requisitos:** Fase 1 concluída (normalização). Fase 2 pode estar em paralelo.
> **Custo estimado:** 2 dias.
> **Bloqueia:** Fase 3b (events), Fase 6 (regras de timing).
> **Status:** Não iniciado.

---

## Decisões de design

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Granularidade | Por `(puuid, role, patch)` | Um player pode ter perfis de timing distintos por role |
| Métricas da Fase 3a | 6 campos (ver lista abaixo) | Tudo computável só com frames — sem precisar de events (Bloco 0) |
| Refresh | Incremental | Script pega matches novos; marca last_processed |
| Nova dimensão "Scaling" | `avg_gold_per_min` do late game + `scaling_inflection_minute` | Player que cresce mais rápido na segunda metade do jogo |
| Nova dimensão "Early Pressure" | `gold_diff_at_10` + `cs_diff_at_15` | Vantagem nos primeiros 15 min |
| Sample mínimo por puuid | 5 matches | Menos que isso e a média é ruído |

---

## Steps

### Step 3a.1 — Fechar lista de métricas

**Métricas da Fase 3a (só frames):**

| Campo | Fórmula | Unidade |
|---|---|---|
| `gold_diff_at_10` | `gold[10] - avg(gold[10] de quem jogou na lane oposta nessa mesma role na mesma match)` | ouro |
| `cs_diff_at_15` | análogo pra CS aos 15 min | CS |
| `scaling_inflection_minute` | minuto em que a 2ª derivada de `gold_cumulative` vira positiva (onde a curva começa a acelerar) | min |
| `peak_lead_minute` | minuto com maior `gold - média_team_oposto` | min |
| `avg_gold_per_min_late` | média de gold/m nos últimos 30% da partida | gold/min |
| `avg_cspm_first_15` | CS/m nos primeiros 15 min | CS/min |

**Lógica do "lane oposta":** pegar o participante do time adversário na mesma `team_position`. Se não existe (ex: posição UNKNOWN), usa a média dos 5 inimigos.

---

### Step 3a.2 — Migration `004_create_player_timing_profile.sql`

**Output:** `database/migrations/004_create_player_timing_profile.sql`.

```sql
-- Migration 004 — Tabela player_timing_profile (Fase 3a)
--
-- Métricas de timing extraídas dos frames da timeline, agregadas por
-- (puuid, role, patch). Alimenta 2 dimensões novas no perfil (10D).

CREATE TABLE IF NOT EXISTS player_timing_profile (
  puuid                      TEXT NOT NULL,
  role                       TEXT NOT NULL,
  patch                      TEXT NOT NULL,
  gold_diff_at_10            DOUBLE PRECISION,
  cs_diff_at_15              DOUBLE PRECISION,
  scaling_inflection_minute  DOUBLE PRECISION,
  peak_lead_minute           DOUBLE PRECISION,
  avg_gold_per_min_late      DOUBLE PRECISION,
  avg_cspm_first_15          DOUBLE PRECISION,
  sample_size                INTEGER NOT NULL,
  last_match_id              TEXT,          -- pra refresh incremental
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (puuid, role, patch)
);

CREATE INDEX IF NOT EXISTS player_timing_profile_patch_idx
  ON player_timing_profile (patch);

ALTER TABLE player_timing_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_timing_profile_select_public" ON player_timing_profile;
CREATE POLICY "player_timing_profile_select_public"
  ON player_timing_profile FOR SELECT TO public USING (true);
```

Aplicar via MCP como sempre.

---

### Step 3a.3 — Investigar o endpoint `/match/{id}/timeline`

**Objetivo:** documentar o schema exato que o backend já retorna antes de escrever o agregador.

**Comando:**
```bash
curl -s "http://localhost:8002/api/v1/match/BR1_XXX/timeline" \
  -H "X-API-Key: $METIS_API_KEY" | jq '.frames[0]'
```

**Formato esperado** (baseado no que vi em `process_timelines.py`):
```json
{
  "t_min": 10,
  "t_ms": 600000,
  "p": {
    "<puuid1>": { "cs": 85, "cspm": 8.5, "gold": 5200, "level": 8, "xp": 6100 },
    "<puuid2>": { ... }
  }
}
```

Anotar no sub-plano se tiver algum campo extra ou se o formato divergir.

---

### Step 3a.4 — Escrever `build_timing_profiles.py`

**Output:** `scripts/processing/build_timing_profiles.py`.
**Bibliotecas:**
- `polars` (agregação rápida)
- `supabase-py`
- `httpx` (consumir `/timeline` endpoint próprio)
- `python-dotenv`

**Estrutura:**

```python
"""
build_timing_profiles.py — popula player_timing_profile.

Uso:
    python -m scripts.processing.build_timing_profiles
    python -m scripts.processing.build_timing_profiles --puuid XXX
    python -m scripts.processing.build_timing_profiles --since-days 30
"""

from __future__ import annotations
import argparse
import logging
import os
import sys
from collections import defaultdict
from typing import Any

import httpx
import polars as pl
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("build_timing_profiles")

API_URL = os.environ.get("METIS_API_URL", "http://localhost:8002")
API_KEY = os.environ.get("METIS_API_KEY", "")
MIN_SAMPLE = 5


def fetch_match_ids_for_puuid(db, puuid: str, since_days: int | None = None) -> list[dict]:
    """Retorna matches do puuid como lista de {match_id, role, patch, team_id}."""
    q = (
        db.table("match_participants")
        .select("match_id, team_position, team_id, matches(game_version)")
        .eq("puuid", puuid)
    )
    rows = q.execute().data or []
    flat = []
    for r in rows:
        mi = r.get("match_id")
        role = r.get("team_position")
        team_id = r.get("team_id")
        gv = (r.get("matches") or {}).get("game_version")
        if mi and role and gv and role in {"TOP","JUNGLE","MIDDLE","BOTTOM","UTILITY"}:
            flat.append({"match_id": mi, "role": role, "patch": gv, "team_id": team_id, "puuid": puuid})
    return flat


def fetch_timeline(match_id: str) -> dict | None:
    with httpx.Client(timeout=30) as client:
        try:
            r = client.get(
                f"{API_URL}/api/v1/match/{match_id}/timeline",
                headers={"X-API-Key": API_KEY},
            )
            if r.status_code != 200:
                return None
            return r.json()
        except Exception as err:
            logger.warning(f"  timeline fetch falhou pra {match_id}: {err}")
            return None


def compute_metrics_for_match(
    timeline: dict,
    puuid: str,
    role: str,
    team_id: int,
    participants: list[dict],  # [{puuid, team_id, team_position}]
) -> dict | None:
    """
    Retorna dict com as 6 métricas pra esse (match, puuid, role).
    None se match muito curta (< 15 frames).
    """
    frames = timeline.get("frames", [])
    if len(frames) < 15:
        return None

    # Mapeia puuid → role oposto
    enemy_team_id = 200 if team_id == 100 else 100
    enemy_opposite = next(
        (p["puuid"] for p in participants
         if p["team_id"] == enemy_team_id and p["team_position"] == role),
        None,
    )

    def frame_val(t_min: int, key: str, puuid_: str) -> float | None:
        if t_min >= len(frames):
            return None
        return (frames[t_min].get("p") or {}).get(puuid_, {}).get(key)

    # gold_diff_at_10
    g10_self = frame_val(10, "gold", puuid)
    g10_enemy = frame_val(10, "gold", enemy_opposite) if enemy_opposite else None
    if g10_enemy is None and len(frames) > 10:
        # fallback: média dos 5 inimigos
        enemy_gold = [
            (frames[10].get("p") or {}).get(p["puuid"], {}).get("gold", 0)
            for p in participants if p["team_id"] == enemy_team_id
        ]
        g10_enemy = sum(enemy_gold) / len(enemy_gold) if enemy_gold else None
    gold_diff_10 = (g10_self - g10_enemy) if (g10_self is not None and g10_enemy is not None) else None

    # cs_diff_at_15
    c15_self = frame_val(15, "cs", puuid)
    c15_enemy = frame_val(15, "cs", enemy_opposite) if enemy_opposite else None
    cs_diff_15 = (c15_self - c15_enemy) if (c15_self is not None and c15_enemy is not None) else None

    # scaling_inflection_minute — minuto em que dg/dt vira > média da primeira metade
    gold_series = [frame_val(t, "gold", puuid) or 0 for t in range(len(frames))]
    if len(gold_series) < 10:
        scaling_inflection = None
    else:
        dgold = [gold_series[t] - gold_series[t-1] for t in range(1, len(gold_series))]
        half = len(dgold) // 2
        avg_first = sum(dgold[:half]) / half if half > 0 else 0
        # primeiro minuto na segunda metade onde dgold > avg_first * 1.2
        scaling_inflection = None
        for t, dg in enumerate(dgold[half:], start=half):
            if dg > avg_first * 1.2:
                scaling_inflection = float(t)
                break

    # peak_lead_minute
    lead_series = []
    enemy_gold_series = []
    for t in range(len(frames)):
        self_g = frame_val(t, "gold", puuid) or 0
        enemies = [
            (frames[t].get("p") or {}).get(p["puuid"], {}).get("gold", 0)
            for p in participants if p["team_id"] == enemy_team_id
        ]
        avg_enemy = sum(enemies) / len(enemies) if enemies else 0
        enemy_gold_series.append(avg_enemy)
        lead_series.append(self_g - avg_enemy)
    if lead_series:
        peak_minute = float(max(range(len(lead_series)), key=lambda i: lead_series[i]))
    else:
        peak_minute = None

    # avg_gold_per_min_late — últimos 30% dos frames
    late_start = int(len(frames) * 0.7)
    late_gold_vals = [frame_val(t, "gold", puuid) for t in range(late_start, len(frames))]
    late_gold_vals = [v for v in late_gold_vals if v is not None]
    if len(late_gold_vals) >= 2:
        late_duration = len(frames) - late_start
        gold_gain_late = late_gold_vals[-1] - late_gold_vals[0]
        avg_gpm_late = gold_gain_late / late_duration if late_duration > 0 else None
    else:
        avg_gpm_late = None

    # avg_cspm_first_15
    cs15 = frame_val(15, "cs", puuid) or 0
    avg_cspm_first_15 = cs15 / 15.0 if cs15 > 0 else None

    return {
        "gold_diff_at_10":            gold_diff_10,
        "cs_diff_at_15":              cs_diff_15,
        "scaling_inflection_minute":  scaling_inflection,
        "peak_lead_minute":           peak_minute,
        "avg_gold_per_min_late":      avg_gpm_late,
        "avg_cspm_first_15":          avg_cspm_first_15,
    }


def aggregate_for_puuid(db, puuid: str) -> list[dict]:
    """Por (puuid, role, patch), agrega N matches e retorna rows pra upsert."""
    all_matches = fetch_match_ids_for_puuid(db, puuid)
    if not all_matches:
        return []

    # Agrupa por role
    by_role: dict[str, list[dict]] = defaultdict(list)
    for m in all_matches:
        by_role[m["role"]].append(m)

    out = []
    for role, matches in by_role.items():
        metrics_list: list[dict] = []
        for m in matches:
            # Precisamos dos participantes de cada match pra identificar o inimigo
            parts = (
                db.table("match_participants")
                .select("puuid, team_id, team_position")
                .eq("match_id", m["match_id"])
                .execute()
                .data or []
            )
            timeline = fetch_timeline(m["match_id"])
            if not timeline:
                continue
            metrics = compute_metrics_for_match(
                timeline, puuid, role, m["team_id"], parts
            )
            if metrics:
                metrics["patch"] = m["patch"]
                metrics_list.append(metrics)

        # Agrupar por patch e tirar média
        by_patch: dict[str, list[dict]] = defaultdict(list)
        for m in metrics_list:
            by_patch[m["patch"]].append(m)

        for patch, items in by_patch.items():
            if len(items) < MIN_SAMPLE:
                continue
            avg_metrics: dict[str, Any] = {"puuid": puuid, "role": role, "patch": patch, "sample_size": len(items)}
            for key in ["gold_diff_at_10","cs_diff_at_15","scaling_inflection_minute",
                        "peak_lead_minute","avg_gold_per_min_late","avg_cspm_first_15"]:
                vals = [m[key] for m in items if m.get(key) is not None]
                avg_metrics[key] = (sum(vals) / len(vals)) if vals else None
            out.append(avg_metrics)

    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--puuid", help="Processa só esse puuid")
    ap.add_argument("--since-days", type=int, help="Só matches dos últimos N dias (ainda não implementado, TODO)")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL e SUPABASE_KEY são obrigatórios")
        return 1

    db = create_client(url, key)

    if args.puuid:
        puuids = [args.puuid]
    else:
        # Pega puuids ativos (>= 10 matches totais)
        rows = db.table("match_participants").select("puuid").execute().data or []
        counts: dict[str, int] = defaultdict(int)
        for r in rows:
            counts[r["puuid"]] += 1
        puuids = [p for p, n in counts.items() if n >= 10]
        logger.info(f"{len(puuids)} puuids ativos pra processar")

    total_rows = 0
    for i, puuid in enumerate(puuids, 1):
        logger.info(f"[{i}/{len(puuids)}] {puuid[:12]}...")
        rows = aggregate_for_puuid(db, puuid)
        if rows:
            db.table("player_timing_profile").upsert(rows, on_conflict="puuid,role,patch").execute()
            total_rows += len(rows)

    logger.info(f"✓ Completo: {total_rows} rows upsertadas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Comentário honesto sobre escala:** pro primeiro run com todos os puuids ativos, isso vai ser lento (1 HTTP por match × N matches × M puuids). Pra v0.9.0, rodar pra top 100 players ativos é suficiente. Otimizar depois com batch fetch se precisar.

---

### Step 3a.5 — Primeiro run + validação

**Comando pra teste focado:**
```bash
./.venv/Scripts/python.exe -m scripts.processing.build_timing_profiles --puuid <teu-puuid>
```

**Validação:**
```sql
SELECT * FROM player_timing_profile WHERE puuid = '<teu-puuid>';
-- Esperado: 1-3 rows (uma por role principal × patches)
-- gold_diff_at_10 deve ser + se tu costumas ganhar cedo, - se perde
-- scaling_inflection entre 10-25 geralmente (quando começa a subir a curva)
```

Se algum campo vier sempre NULL, investigar o `fetch_timeline` e `compute_metrics_for_match`.

---

### Step 3a.6 — Expandir `role_stat_refs` pra cobrir timing stats

**Mudança:** adicionar as 6 stats de timing à lista de `ROLE_STAT_FIELDS` **mas** elas vêm de `player_timing_profile`, não de `match_participants`. Vai precisar ajustar o script da Fase 0.

**Alternativa escolhida:** criar segundo script `refresh_role_timing_refs.py` que faz o mesmo mas agrupa `player_timing_profile` por role. Usa a mesma tabela `role_stat_refs`.

```python
# scripts/processing/refresh_role_timing_refs.py (novo)
# Lê player_timing_profile, agrupa por (role, patch), computa refs pros 6 timing fields,
# upserta em role_stat_refs com os mesmos nomes de stat.
```

---

### Step 3a.7 — Expandir perfil pra 10D no `recommendation_service`

**Mudança em `_build_8d_profile`** — rename pra `_build_profile` e retorna 10D:

```python
def _build_profile(
    rows: list[dict],
    role: str,
    role_refs: dict[str, dict[str, tuple[float, float]]],
    timing_refs: dict[str, dict[str, tuple[float, float]]] | None = None,
    puuid: str | None = None,   # pra buscar timing profile
    db_client: Any = None,
) -> list[float]:
    """Perfil 10D (8 originais + Scaling + Early Pressure)."""
    base_8d = _build_8d_profile_core(rows, role, role_refs)

    # Dimensão 9: Scaling
    # Dimensão 10: Early Pressure
    if puuid and db_client and timing_refs and role in timing_refs:
        tp = (
            db_client.table("player_timing_profile")
            .select("*")
            .eq("puuid", puuid)
            .eq("role", role)
            .order("patch", desc=True)
            .limit(1)
            .execute()
            .data or []
        )
        if tp:
            t = tp[0]
            refs = timing_refs.get(role, {})

            # Scaling = média de z-scores de (scaling_inflection_minute * -1, avg_gold_per_min_late)
            # inflection negativa porque quanto MENOR o minuto, MELHOR (scale earlier)
            scaling_score = _combined_z(
                t,
                fields=[
                    ("scaling_inflection_minute", refs.get("scaling_inflection_minute"), True),   # reverso
                    ("avg_gold_per_min_late",     refs.get("avg_gold_per_min_late"),     False),
                ],
            )

            # Early Pressure
            early_score = _combined_z(
                t,
                fields=[
                    ("gold_diff_at_10",      refs.get("gold_diff_at_10"),      False),
                    ("cs_diff_at_15",        refs.get("cs_diff_at_15"),        False),
                    ("avg_cspm_first_15",    refs.get("avg_cspm_first_15"),    False),
                ],
            )
        else:
            scaling_score = 5.0
            early_score = 5.0
    else:
        scaling_score = 5.0
        early_score = 5.0

    return base_8d + [round(scaling_score, 2), round(early_score, 2)]


def _combined_z(row: dict, fields: list[tuple[str, tuple | None, bool]]) -> float:
    """Média dos z-scores dos fields. Field inverso multiplica z por -1."""
    scores = []
    for field, ref, reverse in fields:
        val = row.get(field)
        if val is None or ref is None or ref[1] == 0:
            continue
        z = (val - ref[0]) / ref[1]
        if reverse:
            z = -z
        scores.append(_z_to_score(z))
    return sum(scores) / len(scores) if scores else 5.0
```

---

### Step 3a.8 — Atualizar constante `DIMENSION_NAMES`

```python
DIMENSION_NAMES = [
    "Agressividade",
    "Controle de Mapa",
    "Eficiência",
    "Pressão",
    "Sobrevivência",
    "Utilidade",
    "Early Game",
    "Consistência",
    "Scaling",        # novo
    "Early Pressure", # novo
]
```

**Frontend:** o `DualRadar` existente no `/players/[puuid]` precisa ganhar 2 eixos. Testar visualmente que não vira estrela deformada.

---

### Step 3a.9 — GitHub Action semanal

**Workflow:** `.github/workflows/refresh_timing_profiles.yml`.
Similar ao da Fase 0 — runs `build_timing_profiles.py` + `refresh_role_timing_refs.py` em sequência.

Frequência: **diária** (só top 50 puuids ativos) ou **semanal** completa. Começar semanal pra simplicidade.

---

## Critério de "done" da Fase 3a

- [ ] Migration 004 aplicada
- [ ] `build_timing_profiles.py` roda pra 1 puuid e popula
- [ ] Rollout pra top 50 puuids ativos
- [ ] `refresh_role_timing_refs.py` adiciona as 6 stats em `role_stat_refs`
- [ ] `_build_profile` retorna 10D
- [ ] Frontend DualRadar renderiza 10 eixos sem quebrar
- [ ] A/B manual: player hyper-carry conhecido tem Scaling > Early Pressure; player de early lead tem o inverso
- [ ] Patch notes atualizado

---

## Rollback

- Reverter commit do `recommendation_service` volta pra 8D
- `player_timing_profile` fica órfã mas não incomoda
- GitHub Action pausa ou remove

---

## Patch notes sugerido

```markdown
## p-0.10.0-alpha.3 — Fase 3a: Timing via Frames (YYYY-MM-DD)

Perfil do jogador ganhou dimensão temporal.

### Database
- Nova tabela `player_timing_profile` com 6 métricas de timing por (puuid, role, patch)

### Backend
- `recommendation_service` agora retorna perfil 10D (8 originais + `Scaling` + `Early Pressure`)
- Novas stats em `role_stat_refs` (refresh consolidado com Fase 0)
- Script `build_timing_profiles.py` processa frames da `/timeline` endpoint e popula

### Frontend
- `DualRadar` no dashboard do player renderiza 10 eixos

### Próximo
- Fase 3b adicionará `avg_death_minute` e `first_blood_rate` quando o parser de events (Bloco 0) for entregue
```
