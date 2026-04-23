# Fase 1 — Normalização real no perfil 8D

> **Objetivo:** substituir os thresholds hardcoded em `_build_8d_profile` por **z-score** calculado contra a tabela `role_stat_refs` da Fase 0. O perfil passa a ter significado estatístico real (5.0 = mediana da role, 10.0 = top ~2%).
>
> **Pré-requisitos:** Fase 0 concluída.
> **Custo estimado:** 1–2 dias.
> **Bloqueia:** Fases 2, 6, 7.
> **Status:** Não iniciado.

---

## Decisões de design

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Fórmula z→score | Linear: `score = clip((z+2)/4*10, 0, 10)` | Z=0 vira 5, z=+2 vira 10, z=-2 vira 0. Previsível, sem saturação surpresa. Já testei mentalmente vs sigmoid — linear explica melhor no frontend |
| Onde cacheia `role_refs` | Em memória no módulo (TTL 1h) | Query Supabase 1× por hora, depois usa dict Python. Reduz ~500ms/request pra ~zero |
| Fallback se `role_stat_refs` vazia | Thresholds hardcoded antigos (modo legado) | Não quebrar em dev/fresh install. Loga warning |
| O que fazer com `consistência` (dim 8 = winrate) | Não normaliza por z-score — mantém `winrate × 10` | Winrate já é 0–1, não faz sentido comparar com média da role |
| Pesos internos das dimensões | Mantidos os atuais | Peso das sub-stats dentro de cada dim (ex: 25% kills + 30% KP) continua. Só o cálculo bruto muda |

---

## Steps

### Step 1.1 — Criar `stats_refs_cache.py`

**Inputs:** tabela `role_stat_refs` populada (Fase 0).
**Output:** `backend/services/stats_refs_cache.py`.
**Bibliotecas:** `supabase-py`, stdlib (`time`).

```python
"""
stats_refs_cache.py — cache em memória dos role_stat_refs.

Reduz query repetida à tabela role_stat_refs. TTL de 1h é seguro —
refresh da tabela é semanal, mas damos margem pra casos de re-run manual.
"""

from __future__ import annotations
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 3600  # 1h
_cache: dict[str, Any] = {
    "data": None,
    "patch": None,
    "expires_at": 0.0,
}


def _is_expired() -> bool:
    return time.time() >= _cache["expires_at"]


def _select_latest_patch(db_client) -> str | None:
    """Retorna o patch mais recente presente em role_stat_refs."""
    res = (
        db_client.table("role_stat_refs")
        .select("patch")
        .order("patch", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0]["patch"] if rows else None


def get_role_refs(db_client, patch: str | None = None) -> dict[str, dict[str, tuple[float, float]]]:
    """
    Retorna dict aninhado:
        {
          "JUNGLE": {"cs_per_minute": (avg, stddev), "kills": (avg, stddev), ...},
          "TOP": {...},
          ...
        }

    Se `patch=None`, usa o mais recente disponível. Cacheia em memória.
    Retorna dict vazio se a tabela estiver vazia.
    """
    now = time.time()
    if not _is_expired() and _cache["data"] is not None and (patch is None or _cache["patch"] == patch):
        return _cache["data"]

    target_patch = patch or _select_latest_patch(db_client)
    if target_patch is None:
        logger.warning("role_stat_refs está vazia — retornando dict vazio (fallback kicks in)")
        return {}

    rows = (
        db_client.table("role_stat_refs")
        .select("role, stat_name, avg, stddev")
        .eq("patch", target_patch)
        .execute()
        .data or []
    )

    out: dict[str, dict[str, tuple[float, float]]] = {}
    for r in rows:
        role = r["role"]
        out.setdefault(role, {})[r["stat_name"]] = (r["avg"], r["stddev"])

    _cache["data"] = out
    _cache["patch"] = target_patch
    _cache["expires_at"] = now + _CACHE_TTL_SECONDS
    logger.info(f"role_refs cache refresh: {len(out)} roles, patch={target_patch}")
    return out


def invalidate() -> None:
    """Útil pra admin endpoint / testes."""
    _cache["data"] = None
    _cache["patch"] = None
    _cache["expires_at"] = 0.0
```

**Validação:**
- Chamar 2× em sequência → segunda chamada não faz query (verificar via log)
- `invalidate()` força refresh
- Se `role_stat_refs` vazia, retorna `{}` sem crashear

---

### Step 1.2 — Adicionar helper `z_to_score`

**Inputs:** nenhum.
**Output:** função em `backend/services/recommendation_service.py`.
**Bibliotecas:** stdlib.

```python
def _z_to_score(z: float) -> float:
    """
    Converte z-score em score 0-10 linear.
    z=0 → 5.0 (mediana da role)
    z=+2 → 10.0 (top ~2%)
    z=-2 → 0.0 (bottom ~2%)
    """
    return max(0.0, min(10.0, (z + 2.0) / 4.0 * 10.0))


def _stat_score(
    player_rows: list[dict],
    stat_name: str,
    role_refs: dict[str, tuple[float, float]],
    default_score: float = 5.0,
) -> float:
    """
    Score 0-10 de um stat específico, normalizado contra a role.
    Se não tem ref pro stat, retorna default (5.0 = neutro).
    """
    ref = role_refs.get(stat_name)
    if not ref:
        return default_score
    avg, stddev = ref
    if stddev == 0:
        return default_score

    player_vals = [_safe(r.get(stat_name)) for r in player_rows if r.get(stat_name) is not None]
    if not player_vals:
        return default_score

    player_avg = sum(player_vals) / len(player_vals)
    z = (player_avg - avg) / stddev
    return _z_to_score(z)
```

**Testes unitários** (ficam em `tests/test_recommendation.py`):

```python
def test_z_to_score_zero():
    assert _z_to_score(0.0) == 5.0

def test_z_to_score_plus_two():
    assert _z_to_score(2.0) == 10.0

def test_z_to_score_minus_two():
    assert _z_to_score(-2.0) == 0.0

def test_z_to_score_clips():
    assert _z_to_score(10.0) == 10.0
    assert _z_to_score(-10.0) == 0.0

def test_z_to_score_one():
    assert abs(_z_to_score(1.0) - 7.5) < 1e-9
```

---

### Step 1.3 — Refatorar `_build_8d_profile` pra aceitar role_refs

**Inputs:** Step 1.2.
**Output:** assinatura nova e cálculo reescrito.

Assinatura nova:
```python
def _build_8d_profile(
    rows: list[dict],
    role: str,                                    # novo
    role_refs: dict[str, dict[str, tuple[float, float]]],  # novo
) -> list[float]:
```

Reescrita de cada dimensão — mantém os pesos internos, muda a fonte do score:

```python
def _build_8d_profile(
    rows: list[dict],
    role: str,
    role_refs: dict[str, dict[str, tuple[float, float]]],
) -> list[float]:
    """Perfil 8D normalizado via z-score contra role_stat_refs da Fase 0."""
    if not rows:
        return [0.0] * 8

    refs_for_role = role_refs.get(role, {})

    # Helper local
    def stat(name: str) -> float:
        return _stat_score(rows, name, refs_for_role)

    # 1. Agressividade — mix ponderado de sub-stats
    #    Pesos mantidos: kills 25%, solo_kills 20%, KP 30%, DPM 25%
    agressividade = (
        stat("kills") * 0.25 +
        stat("solo_kills") * 0.20 +
        stat("kill_participation") * 0.30 +
        stat("damage_per_minute") * 0.25
    )

    # 2. Controle de Mapa — dominado por vision_score
    controle_mapa = stat("vision_score")

    # 3. Eficiência de Recursos — gold/min + cs/min
    eficiencia = stat("gold_per_minute") * 0.5 + stat("cs_per_minute") * 0.5

    # 4. Pressão em Estruturas
    pressao = stat("damage_dealt_to_buildings")

    # 5. Sobrevivência — KDA + penalidade por deaths
    #    Usa z-score do "deaths" com sinal invertido (mais mortes = pior)
    deaths_ref = refs_for_role.get("deaths")
    if deaths_ref and deaths_ref[1] > 0:
        avg_d = sum(_safe(r.get("deaths")) for r in rows) / len(rows)
        z_deaths = (avg_d - deaths_ref[0]) / deaths_ref[1]
        deaths_score = _z_to_score(-z_deaths)  # invertido
    else:
        deaths_score = 5.0

    kda_score = (stat("kills") + stat("assists")) / 2.0  # média das duas
    sobrevivencia = kda_score * 0.5 + deaths_score * 0.5

    # 6. Utilidade — razão assists/(kills+assists)
    #    Essa é derivada, não tem ref direto. Vamos normalizar na mão.
    avg_kills = sum(_safe(r.get("kills")) for r in rows) / len(rows)
    avg_assists = sum(_safe(r.get("assists")) for r in rows) / len(rows)
    denom = avg_kills + avg_assists
    assist_ratio = avg_assists / denom if denom > 0 else 0.5
    # Ratio 0-1. Transforma pra 0-10 com 0.5 = meio.
    utilidade = min(10.0, assist_ratio * 10.0 * 1.3)  # escala levemente pra roles de suporte

    # 7. Early Game — gold/xp advantage nos primeiros minutos
    early_game = stat("early_laning_phase_gold_exp_advantage")

    # 8. Consistência = winrate × 10 (não normaliza por role)
    wins = sum(1 for r in rows if r.get("win"))
    consistencia = (wins / len(rows)) * 10.0 if rows else 0.0

    return [
        round(max(0.0, min(10.0, agressividade)), 2),
        round(max(0.0, min(10.0, controle_mapa)), 2),
        round(max(0.0, min(10.0, eficiencia)), 2),
        round(max(0.0, min(10.0, pressao)), 2),
        round(max(0.0, min(10.0, sobrevivencia)), 2),
        round(max(0.0, min(10.0, utilidade)), 2),
        round(max(0.0, min(10.0, early_game)), 2),
        round(max(0.0, min(10.0, consistencia)), 2),
    ]
```

---

### Step 1.4 — Adaptar `buscar_recomendacoes` pra passar `role_refs`

**Inputs:** Step 1.3.
**Output:** função principal atualizada.

```python
from backend.services.stats_refs_cache import get_role_refs

def buscar_recomendacoes(
    db_client,
    puuid: str,
    role: str | None = None,
    top_n: int = 5,
    include_reasons: bool = False,
) -> list[dict[str, Any]]:

    role_refs = get_role_refs(db_client)   # NOVO

    # ... fetch player_rows ...

    if len(player_rows) < 5:
        return []

    # Perfil geral do jogador — agora precisa saber a role pra normalizar
    # Decisão: usar a role que mais jogou (most frequent)
    main_role = _most_frequent_role(player_rows)
    player_profile = _build_8d_profile(player_rows, main_role, role_refs)

    # Por role
    player_by_role: dict[str, list[dict]] = defaultdict(list)
    for r in player_rows:
        pos = r.get("team_position", "UNKNOWN")
        if pos in role_refs:   # só roles válidas com refs
            player_by_role[pos].append(r)

    # ... resto do código mantido, mas passando role e role_refs pro _build_8d_profile ...

    for key, champ_rows in buckets.items():
        champ_name, champ_role = key.split("|", 1)
        if role and champ_role != role.upper():
            continue

        champ_profile = _build_8d_profile(champ_rows, champ_role, role_refs)

        role_rows = player_by_role.get(champ_role, [])
        compare_profile = (
            _build_8d_profile(role_rows, champ_role, role_refs)
            if len(role_rows) >= 3
            else player_profile
        )

        # ... similaridade, etc ...


def _most_frequent_role(rows: list[dict]) -> str:
    """Retorna a role mais frequente nas rows do player."""
    counts: dict[str, int] = defaultdict(int)
    for r in rows:
        pos = r.get("team_position")
        if pos:
            counts[pos] += 1
    return max(counts.items(), key=lambda kv: kv[1])[0] if counts else "MIDDLE"
```

---

### Step 1.5 — Fallback quando role_refs vazia

**Decisão:** quando `role_refs == {}` (tabela vazia), cair pros thresholds antigos.

```python
# No topo do _build_8d_profile:

refs_for_role = role_refs.get(role, {})
if not refs_for_role:
    logger.warning(f"Sem role_refs pra {role} — usando thresholds legados")
    return _build_8d_profile_legacy(rows)   # função antiga renomeada
```

A função atual fica preservada como `_build_8d_profile_legacy(rows)` por compatibilidade. Remove quando chegar a v0.10.0 estável.

---

### Step 1.6 — A/B test com 5 players conhecidos

**Objetivo:** validar que a normalização nova faz sentido antes de mergear.

**Script em `scripts/analysis/compare_profiles_ab.py` (ad-hoc, não precisa ser mantido):**

```python
"""
compare_profiles_ab.py — compara perfis antigo vs novo pra 5 puuids.
Roda local, imprime markdown comparativo.
"""
import os
from dotenv import load_dotenv
from supabase import create_client
from backend.services.recommendation_service import _build_8d_profile, _build_8d_profile_legacy
from backend.services.stats_refs_cache import get_role_refs

load_dotenv()
db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

PUUIDS = [
    # César, André, Takida e 2 outros
    "PUUID1",
    "PUUID2",
    "PUUID3",
    "PUUID4",
    "PUUID5",
]

role_refs = get_role_refs(db)

for puuid in PUUIDS:
    rows = db.table("match_participants").select("*").eq("puuid", puuid).execute().data or []
    if len(rows) < 5:
        print(f"\n### {puuid[:12]} — menos de 5 partidas\n")
        continue
    role = max([(r.get('team_position'), 1) for r in rows], key=lambda x: x[1])[0] or "MIDDLE"
    old = _build_8d_profile_legacy(rows)
    new = _build_8d_profile(rows, role, role_refs)
    print(f"\n### {puuid[:12]} (role={role}, n={len(rows)})")
    print(f"| Dim | Antigo | Novo | Δ |")
    print(f"|---|---|---|---|")
    names = ["Agressividade", "Mapa", "Eficiência", "Pressão", "Sobrev.", "Utilidade", "Early", "Consist."]
    for i, name in enumerate(names):
        delta = new[i] - old[i]
        print(f"| {name} | {old[i]:.2f} | {new[i]:.2f} | {delta:+.2f} |")
```

**Validação esperada:**
- Player Sup não tem mais "Agressividade 9/10" por threshold baixo
- Player ADC com CS 9/min vs 6/min mostram Eficiência diferente (antes ambos dariam 10)
- Perfil médio fica em torno de 5 em cada dim (hoje muita gente está em 10)

**Critério de aceite:** ver os 5 outputs e decidir:
1. Os novos números fazem sentido intuitivamente?
2. A distribuição tá espalhada (não todo mundo 10/10)?

Se sim → segue. Se não → investiga bug.

---

### Step 1.7 — Smoke test do endpoint

**Comando:**
```bash
curl -s "http://localhost:8002/api/v1/player/recommendations?puuid=XXX&top_n=5" \
  -H "X-API-Key: $METIS_API_KEY" | jq '.[] | {champion, role, similarity, confidence, player_profile}'
```

**Validação:**
- Status 200
- `player_profile` não é mais um array de `[10.0, 10.0, 10.0, ...]` pro player médio
- Ordem dos top-5 pode ter mudado — ok, era o objetivo
- Tempo de resposta equivalente (cache faz a diferença)

---

## Critério de "done" da Fase 1

- [ ] `stats_refs_cache.py` existe e cacheia corretamente
- [ ] `_z_to_score` testada com 5 casos (pytest passa)
- [ ] `_build_8d_profile` aceita `role` e `role_refs`, retorna valores plausíveis
- [ ] `_build_8d_profile_legacy` preservada como fallback
- [ ] A/B test roda e o output faz sentido visualmente
- [ ] Endpoint `/api/v1/player/recommendations` responde 200 com perfil novo
- [ ] `npm run build` frontend passa (nenhuma mudança client-side esperada, mas confirma)
- [ ] Patch notes atualizado

---

## Rollback

Se a normalização nova quebrar a percepção de qualidade das recomendações:

1. **Soft rollback (rápido):** configurar env var `USE_LEGACY_PROFILE=1` que força `_build_8d_profile_legacy` mesmo com role_refs disponível.
2. **Hard rollback:** reverter commit da refatoração. A Fase 0 não precisa ser desfeita — a tabela fica quieta esperando.

---

## Patch notes sugerido

```markdown
## p-0.10.0-alpha.1 — Fase 1: Normalização real (YYYY-MM-DD)

Perfil 8D do recommendation_service passa a usar z-score contra role_stat_refs em vez de thresholds hardcoded.

### Backend
- Novo módulo `stats_refs_cache.py` com TTL 1h em memória (reduz query repetida)
- `_z_to_score(z)` — linear, z=0 → 5, z=±2 → 10/0
- `_build_8d_profile` aceita `role` e `role_refs`
- Fallback automático pra thresholds legados se `role_stat_refs` vazia
- Testes unitários pra `_z_to_score` (5 casos)

### Impacto esperado
- Perfis antes concentrados em 10/10 agora têm distribuição realista (média ~5)
- Recomendações ganham variância — players diferentes recebem top-N diferente
- Player de Sup com kill count baixo deixa de aparecer "pouco agressivo" só porque threshold era hardcoded ADC

### A/B test
- 5 players conhecidos validados — [link pros outputs]
```

---

## Re-aval antes de começar

Antes do Step 1.1:
1. A fórmula linear `z_to_score` está aprovada, ou tu quer sigmoid?
2. TTL de 1h no cache é razoável?
3. Fallback pra legado é a decisão certa, ou prefere que o serviço retorne 503 quando sem refs?
