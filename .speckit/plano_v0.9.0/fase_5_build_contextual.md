# Fase 5 — Build Contextual

> **Objetivo:** analisar item × composição inimiga → recomendar build adaptada ao matchup. *Void Staff vs tank_heavy = 58% WR, vs squishy = 44% WR*. Feature-chave que resolve "qual item comprar depende do contexto".
>
> **Pré-requisitos:** Fase 4 concluída.
> **Custo estimado:** 4 dias.
> **Bloqueia:** nada — é feature nova.
> **Status:** Não iniciado.

---

## Decisões de design

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Número de arquétipos canônicos | 7 (+ "balanced" fallback) | Menos de 5 perde resolução, mais de 10 faz buckets ralos |
| Classificação de comp | Determinística (regras) | Previsível, debugável. ML fica pro futuro se regras não funcionarem |
| Granularidade da cross-tab | `(item_id, champion, role, enemy_archetype, patch)` | Precisão máxima. Pode causar sample size baixo em buckets raros |
| Sample mínimo por bucket | 10 picks | Abaixo disso, não confia no WR |
| Items relevantes | Só itens finais (slot 0-5), ignora trinket | O que importa pra decisão de build |
| Endpoint retorna | Top 6 items + keystone principal + WR médio do conjunto | Alinha com UI existente |
| Overall + per-archetype | Ambos | UI tem dropdown "vs comp" que filtra |

---

## Steps

### Step 5.1 — Formalizar arquétipos canônicos

**Output:** função + testes em `backend/services/comp_service.py`.

**Arquétipos (cf. Anexo B do README):**

```python
def classify_comp_archetype(comp: dict[str, int]) -> str:
    """
    Classifica uma composição (contagem por classe) num arquétipo canônico.
    comp é tipo {"tank": 2, "bruiser": 1, "control_mage": 1, "marksman": 1}
    """
    tanks = comp.get('tank', 0) + comp.get('juggernaut', 0)
    bruisers = comp.get('bruiser', 0)
    skirmishers = comp.get('skirmisher', 0)
    assassins = comp.get('assassin', 0)
    burst_mages = comp.get('burst_mage', 0)
    control_mages = comp.get('control_mage', 0)
    mages = burst_mages + control_mages
    marksmen = comp.get('marksman', 0)
    enchanters = comp.get('enchanter', 0)
    catchers = comp.get('catcher', 0)
    supports = enchanters + catchers

    # Regras em ordem de especificidade — a primeira que bate vence
    if tanks >= 2:
        return "tank_heavy"
    if assassins + skirmishers >= 3:
        return "dive_heavy"
    if catchers + assassins >= 2 and tanks == 0:
        return "pick_comp"
    if control_mages + marksmen >= 2 and enchanters >= 1:
        return "poke_scaling"
    if bruisers + skirmishers >= 3:
        return "bruiser_stack"
    if mages + marksmen >= 3 and tanks == 0:
        return "squishy_burst"
    if enchanters >= 1 and marksmen >= 1 and (tanks + bruisers) >= 1:
        return "teamfight"
    return "balanced"
```

**Testes** (`tests/test_comp_service.py`):
```python
def test_tank_heavy():
    assert classify_comp_archetype({"tank":2,"bruiser":1,"marksman":1,"enchanter":1}) == "tank_heavy"

def test_squishy_burst():
    assert classify_comp_archetype({"burst_mage":2,"marksman":1,"assassin":1,"enchanter":1}) == "squishy_burst"

def test_dive_heavy():
    assert classify_comp_archetype({"skirmisher":2,"assassin":1,"burst_mage":1,"enchanter":1}) == "dive_heavy"

def test_balanced_fallback():
    assert classify_comp_archetype({"bruiser":1,"marksman":1,"burst_mage":1,"enchanter":1,"control_mage":1}) == "balanced"

def test_all_unclassified():
    assert classify_comp_archetype({"unclassified":5}) == "balanced"
```

**Validação:** rodar pra amostra de 100 matches reais e revisar distribuição:
```python
# Ad-hoc query:
archetypes = [classify_comp_archetype(m["red_comp_archetypes"]) for m in matches]
print(Counter(archetypes))
# Esperado: distribuição em 7 buckets, com "balanced" sendo ~20-30%
```

Se um arquétipo virar >50% do dataset, regras estão ruins — ajustar limiares.

---

### Step 5.2 — Migration `007_create_item_context_stats.sql`

```sql
-- Migration 007 — Tabela item_context_stats (Fase 5)
--
-- Cross-tab item × champion × role × enemy_archetype → winrate.
-- Base pra recomendar builds condicionais ao matchup esperado.

CREATE TABLE IF NOT EXISTS item_context_stats (
  item_id           INTEGER NOT NULL,
  champion_name     TEXT NOT NULL,
  role              TEXT NOT NULL,
  enemy_archetype   TEXT NOT NULL,
  patch             TEXT NOT NULL,
  picks             INTEGER NOT NULL DEFAULT 0,
  wins              INTEGER NOT NULL DEFAULT 0,
  winrate           DOUBLE PRECISION GENERATED ALWAYS AS (
    CASE WHEN picks > 0 THEN (wins::float / picks) * 100 ELSE 0 END
  ) STORED,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, champion_name, role, enemy_archetype, patch)
);

-- Índices
CREATE INDEX IF NOT EXISTS ics_champion_role_arch_idx
  ON item_context_stats (champion_name, role, enemy_archetype, patch)
  INCLUDE (item_id, winrate, picks);

CREATE INDEX IF NOT EXISTS ics_patch_idx
  ON item_context_stats (patch);

ALTER TABLE item_context_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_context_stats_select_public" ON item_context_stats;
CREATE POLICY "item_context_stats_select_public"
  ON item_context_stats FOR SELECT TO public USING (true);
```

---

### Step 5.3 — Script `build_item_context.py`

**Output:** `scripts/processing/build_item_context.py`.
**Bibliotecas:** `polars` (cross-tab pesado), `supabase-py`.

**Estrutura:**

```python
"""
build_item_context.py — popula item_context_stats.

Cross-tab massivo: pra cada (participant, match) gera N rows (1 por item buildado),
agrupa por (item, champ, role, enemy_archetype, patch), agrega picks e wins.

Uso:
    python -m scripts.processing.build_item_context
    python -m scripts.processing.build_item_context --patch 16.7
"""

from __future__ import annotations
import argparse
import logging
import os
import sys
from collections import defaultdict
from typing import Any

import polars as pl
from dotenv import load_dotenv
from supabase import create_client
from backend.services.comp_service import classify_comp_archetype

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("build_item_context")

PAGE_SIZE = 1000
MIN_PICKS_IN_BUCKET = 10


def fetch_participants_with_matches(db, patch: str | None = None) -> list[dict]:
    """
    Retorna rows de match_participants enriquecidas com enemy_archetype do time adversário.

    Precisa de JOIN: participants + matches(blue/red_comp_archetypes, game_version)
    """
    out = []
    offset = 0
    while True:
        q = (
            db.table("match_participants")
            .select(
                "match_id, champion_name, team_position, team_id, win, items, "
                "matches(game_version, blue_comp_archetypes, red_comp_archetypes)"
            )
            .range(offset, offset + PAGE_SIZE - 1)
        )
        page = q.execute().data or []
        if not page:
            break

        for r in page:
            m = r.get("matches") or {}
            gv = m.get("game_version")
            if not gv:
                continue
            if patch and gv != patch:
                continue

            team_id = r.get("team_id")
            if team_id == 100:
                enemy_arch_dict = m.get("red_comp_archetypes")
            else:
                enemy_arch_dict = m.get("blue_comp_archetypes")
            if not enemy_arch_dict:
                continue

            enemy_arch = classify_comp_archetype(enemy_arch_dict)

            out.append({
                "champion_name": r.get("champion_name"),
                "role":          r.get("team_position"),
                "enemy_archetype": enemy_arch,
                "patch":         gv,
                "win":           bool(r.get("win")),
                "items":         r.get("items") or [],
            })

        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return out


def aggregate(rows: list[dict]) -> list[dict[str, Any]]:
    """
    Cross-tab: (item, champ, role, arch, patch) → (picks, wins)
    """
    buckets: dict[tuple, dict[str, int]] = defaultdict(lambda: {"picks": 0, "wins": 0})

    for r in rows:
        key_common = (r["champion_name"], r["role"], r["enemy_archetype"], r["patch"])
        items = r["items"][:6]  # só slots 0-5 (ignora trinket = slot 6)
        for item_id in items:
            if not item_id or item_id == 0:
                continue
            key = (item_id, *key_common)
            buckets[key]["picks"] += 1
            if r["win"]:
                buckets[key]["wins"] += 1

    # Expandir pra list of dicts, filtrar sample mínimo
    out = []
    for key, v in buckets.items():
        if v["picks"] < MIN_PICKS_IN_BUCKET:
            continue
        item_id, champ, role, arch, patch = key
        out.append({
            "item_id": item_id,
            "champion_name": champ,
            "role": role,
            "enemy_archetype": arch,
            "patch": patch,
            "picks": v["picks"],
            "wins": v["wins"],
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--patch", help="Processa só esse patch")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL e SUPABASE_KEY obrigatórios")
        return 1

    db = create_client(url, key)

    logger.info("Fetching participants + matches...")
    rows = fetch_participants_with_matches(db, patch=args.patch)
    logger.info(f"{len(rows)} rows fetched")

    logger.info("Cross-tab...")
    agg = aggregate(rows)
    logger.info(f"{len(agg)} buckets acima do sample mínimo ({MIN_PICKS_IN_BUCKET})")

    # Upsert em batches
    for i in range(0, len(agg), 200):
        batch = agg[i:i+200]
        db.table("item_context_stats").upsert(
            batch,
            on_conflict="item_id,champion_name,role,enemy_archetype,patch",
        ).execute()
        logger.info(f"  upsert {i+len(batch)}/{len(agg)}")

    logger.info("✓ Completo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Tempo estimado:** com ~20k participantes, 6 items cada = 120k rows de input → cross-tab colapsa pra talvez 5-15k buckets válidos. Roda em ~1-2 min + tempo de upsert.

---

### Step 5.4 — Endpoint `GET /api/v1/builds/recommend`

**Signature:**
```
GET /api/v1/builds/recommend?champion=Orianna&role=MIDDLE&vs_archetype=tank_heavy&patch=16.7&min_picks=10
```

**Response:**
```json
{
  "champion": "Orianna",
  "role": "MIDDLE",
  "vs_archetype": "tank_heavy",
  "patch": "16.7",
  "sample_size_total": 180,
  "top_items": [
    {"item_id": 3135, "item_name": "Void Staff", "picks": 98,  "wins": 54, "winrate": 55.1},
    {"item_id": 6655, "item_name": "Luden's", "picks": 105, "wins": 51, "winrate": 48.6},
    ...
  ]
}
```

**Código:** `backend/api/routes/builds.py` (novo arquivo)

```python
import os
from fastapi import APIRouter, HTTPException, Query
from supabase import create_client

router = APIRouter(prefix="/api/v1/builds", tags=["Builds"])


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY obrigatórios")
    return create_client(url, key)


@router.get("/recommend")
def recommend_build(
    champion: str = Query(..., description="Nome da Riot (ex: 'Orianna')"),
    role: str = Query(..., description="TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY"),
    vs_archetype: str = Query(..., description="tank_heavy, dive_heavy, etc."),
    patch: str | None = Query(None),
    min_picks: int = Query(10, ge=1),
    top_n: int = Query(6, ge=1, le=10),
):
    """
    Retorna top items pro champ/role contra determinado arquétipo de comp inimiga.
    """
    db = _get_supabase()

    # Se patch None, usa o mais recente da tabela
    if patch is None:
        row = (
            db.table("item_context_stats").select("patch")
            .eq("champion_name", champion).eq("role", role.upper())
            .eq("enemy_archetype", vs_archetype)
            .order("patch", desc=True).limit(1).execute().data
        )
        patch = row[0]["patch"] if row else None
        if patch is None:
            raise HTTPException(status_code=404, detail="Sem dados pra esse contexto")

    rows = (
        db.table("item_context_stats")
        .select("item_id, picks, wins, winrate")
        .eq("champion_name", champion)
        .eq("role", role.upper())
        .eq("enemy_archetype", vs_archetype)
        .eq("patch", patch)
        .gte("picks", min_picks)
        .order("winrate", desc=True)
        .limit(top_n * 2)  # pega mais pra depois filtrar
        .execute()
        .data or []
    )

    # Item names (JOIN com items)
    item_ids = [r["item_id"] for r in rows]
    items_meta = (
        db.table("items").select("item_id, name").in_("item_id", item_ids).execute().data or []
    )
    name_map = {i["item_id"]: i["name"] for i in items_meta}

    top_items = [
        {
            "item_id": r["item_id"],
            "item_name": name_map.get(r["item_id"], f"Item {r['item_id']}"),
            "picks": r["picks"],
            "wins": r["wins"],
            "winrate": round(r["winrate"], 1),
        }
        for r in rows[:top_n]
    ]

    total_picks = sum(r["picks"] for r in rows)

    return {
        "champion": champion,
        "role": role.upper(),
        "vs_archetype": vs_archetype,
        "patch": patch,
        "sample_size_total": total_picks,
        "top_items": top_items,
    }
```

**Registrar no `main.py`:**
```python
from backend.api.routes import ... builds
app.include_router(builds.router)
```

---

### Step 5.5 — Endpoint `GET /api/v1/builds/matchup`

**Objetivo:** retornar breakdown por **todos** os arquétipos pra um champ/role — útil pra UI mostrar comparação.

**Signature:**
```
GET /api/v1/builds/matchup?champion=Orianna&role=MIDDLE&patch=16.7
```

**Response:**
```json
{
  "champion": "Orianna",
  "role": "MIDDLE",
  "patch": "16.7",
  "by_archetype": {
    "tank_heavy": {"sample": 180, "top_items": [...]},
    "squishy_burst": {"sample": 145, "top_items": [...]},
    "balanced": {"sample": 320, "top_items": [...]},
    ...
  }
}
```

Implementação: loop sobre os 8 arquétipos, chama lógica do endpoint 5.4 internamente.

---

### Step 5.6 — UI na tab Builds do `/champions/[champion]`

**Adicionar seletor** "vs composição inimiga":
- Dropdown com 8 opções: "Todas", "tank_heavy", "dive_heavy", "pick_comp", etc.
- Quando muda, re-fetch do endpoint e re-renderiza tabela de items.

**Componente:** `<ArchetypeSelector>` em `frontend/src/components/design/ArchetypeSelector.tsx` (novo).

**Labels em PT-BR:**
```tsx
const ARCHETYPE_LABELS = {
  all: "Todas",
  tank_heavy: "Comp pesada (2+ tanks)",
  dive_heavy: "Dive (assassinos + skirmishers)",
  pick_comp: "Pick (CC pesado)",
  poke_scaling: "Poke & scaling",
  bruiser_stack: "Bruiser stack",
  squishy_burst: "Squishy / burst",
  teamfight: "Teamfight clássico",
  balanced: "Balanceada",
}
```

---

### Step 5.7 — Integrar na recomendação de campeão

Pro `/players/[puuid]`, cada champ recomendado pode expandir em **2 builds alternativas**:
- "se cair contra tank_heavy": build A
- "se cair contra squishy": build B

Frontend chama `/api/v1/builds/matchup` quando expande, filtra os 2 mais relevantes (top 2 arquétipos mais frequentes no meta) pra não poluir.

---

## Critério de "done" da Fase 5

- [ ] Migration 007 aplicada, `item_context_stats` criada
- [ ] `classify_comp_archetype` + testes
- [ ] `build_item_context.py` roda e popula (N buckets válidos)
- [ ] Endpoint `/api/v1/builds/recommend` responde 200 com dados plausíveis
- [ ] Endpoint `/api/v1/builds/matchup` idem
- [ ] Sanity check: Void Staff (item_id 3135) tem WR maior em `tank_heavy` que em `squishy_burst` pra pelo menos 3 mages
- [ ] UI tab Builds do champion page ganha seletor
- [ ] Recomendação de player mostra 2 builds condicionais
- [ ] Patch notes

---

## Rollback

- Dropar `item_context_stats` (seguro — ninguém mais consome)
- Remover endpoints/router do `main.py`
- UI reverte pra versão anterior

---

## Patch notes sugerido

```markdown
## p-0.10.0-alpha.6 — Fase 5: Build Contextual (YYYY-MM-DD)

Recomendação de build agora considera a composição inimiga. Void Staff vs tanks ≠ vs squishies.

### Database
- Nova tabela `item_context_stats` com cross-tab item × champion × role × enemy_archetype × patch

### Backend
- 7 arquétipos canônicos + `classify_comp_archetype()` determinística
- Endpoints `/api/v1/builds/recommend` e `/api/v1/builds/matchup`
- `build_item_context.py` agrega ~N buckets válidos

### Frontend
- Champion page ganha seletor "vs composição inimiga" na tab Builds
- Player dashboard mostra 2 builds alternativas por champ recomendado

### Insight destaque
- Void Staff tem WR X% em tank_heavy vs Y% em squishy_burst pra Orianna Mid
- [3 exemplos de diferença significativa]
```
