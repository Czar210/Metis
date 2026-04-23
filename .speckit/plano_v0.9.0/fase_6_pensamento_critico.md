# Fase 6 — Pensamento Crítico (regras determinísticas)

> **Objetivo:** substituir reasons descritivos ("X compatível") por **diagnósticos prescritivos e específicos** via catálogo de regras Python. Cada insight é uma regra com condição determinística + template de texto.
>
> **Pré-requisitos:** Fases 1, 2, 3a concluídas. Fase 3b opcional (libera 2-3 regras extras).
> **Custo estimado:** 3 dias.
> **Bloqueia:** Fase 7 (IA consome os insights como input).
> **Status:** Não iniciado.

---

## Decisões de design

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Regras em Python ou config externa? | Python dataclass | Tipagem forte, refator seguro. Config externa ganharia agilidade mas não vale o overhead agora |
| Template — jinja2 ou f-string? | Lambda + f-string implícito via `fill(ctx)` | Menor footprint, sem dependência nova |
| Ranking | priority × relevance | Regra crítica sempre sobe; relevance = magnitude do desvio |
| Quantos insights retornar | Top 5 | Mais que isso vira ruído na UI |
| Idioma | PT-BR | Usuário é brasileiro |
| Escopo da regra | Pode combinar perfil + matches recentes + timing | Regra poderosa ≠ regra simples |

---

## Steps

### Step 6.1 — Estrutura do módulo `backend/services/insights/`

**Arquivos:**
```
backend/services/insights/
├── __init__.py
├── context.py       # PlayerContext dataclass
├── rules.py         # Rule dataclass + catálogo
└── engine.py        # generate_insights(ctx) -> list[dict]
```

---

### Step 6.2 — `PlayerContext` dataclass

**Arquivo:** `backend/services/insights/context.py`.

```python
"""
context.py — Agrupa todo o contexto do jogador num objeto imutável.
Construído pelo serviço, passado pras regras sem dependência de DB.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class PlayerContext:
    puuid: str
    main_role: str
    patch: str | None

    # Fase 1: perfil 8D/10D normalizado
    profile_all: list[float]
    profile_wins: list[float] | None
    profile_losses: list[float] | None
    delta: list[float] | None
    delta_confidence: str  # 'high' | 'low' | 'none'

    # Fase 3: timing
    timing: dict[str, float | None] = field(default_factory=dict)

    # Role refs (pra comparação contra a média)
    role_refs: dict[str, tuple[float, float]] = field(default_factory=dict)

    # Recent matches summary
    recent_count: int = 0
    recent_winrate: float = 0.0
    matches_after_loss_wr: float | None = None   # tilt detection

    # Top champions / pool
    champ_pool_size: int = 0
    top_champ: str | None = None
    top_champ_winrate: float | None = None

    # Social
    best_duo: dict | None = None   # {"ally_name", "games", "wr"}

    # Dimensões por índice (pra simplificar acesso)
    @property
    def agressao(self) -> float: return self.profile_all[0] if self.profile_all else 0
    @property
    def mapa(self) -> float: return self.profile_all[1] if self.profile_all else 0
    @property
    def eficiencia(self) -> float: return self.profile_all[2] if self.profile_all else 0
    @property
    def pressao(self) -> float: return self.profile_all[3] if self.profile_all else 0
    @property
    def sobrevivencia(self) -> float: return self.profile_all[4] if self.profile_all else 0
    @property
    def utilidade(self) -> float: return self.profile_all[5] if self.profile_all else 0
    @property
    def early(self) -> float: return self.profile_all[6] if self.profile_all else 0
    @property
    def consistencia(self) -> float: return self.profile_all[7] if self.profile_all else 0
    @property
    def scaling(self) -> float: return self.profile_all[8] if len(self.profile_all) > 8 else 5.0
    @property
    def early_pressure(self) -> float: return self.profile_all[9] if len(self.profile_all) > 9 else 5.0
```

---

### Step 6.3 — `Rule` dataclass

**Arquivo:** `backend/services/insights/rules.py`.

```python
"""
rules.py — Catálogo de regras de insight.
Cada regra é um Rule() com: id, category, priority, condition, template, fill.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Callable, Any

from .context import PlayerContext


@dataclass(frozen=True)
class Rule:
    id: str
    category: str  # 'farming' | 'vision' | 'safety' | 'aggression' | 'mental' | 'scaling' | ...
    priority: int  # 1-10
    condition: Callable[[PlayerContext], bool]
    template: str
    fill: Callable[[PlayerContext], dict[str, Any]]
    relevance: Callable[[PlayerContext], float] = lambda ctx: 1.0

    def evaluate(self, ctx: PlayerContext) -> dict | None:
        try:
            if not self.condition(ctx):
                return None
            vars_ = self.fill(ctx)
            text = self.template.format(**vars_)
            return {
                "id": self.id,
                "category": self.category,
                "text": text,
                "priority": self.priority,
                "relevance": self.relevance(ctx),
            }
        except Exception:
            return None  # regra falha silenciosa, não quebra o insight gen
```

---

### Step 6.4 — Catálogo inicial (10 regras)

No mesmo arquivo `rules.py`, catálogo:

```python
CATALOG: list[Rule] = [

    # 1. CS abaixo da média da role
    Rule(
        id="cs_below_role_avg",
        category="farming",
        priority=8,
        condition=lambda ctx: (
            ctx.eficiencia < 4.0
            and ctx.role_refs.get("cs_per_minute") is not None
        ),
        template="Seu CS/m está abaixo da média da {role_label} — cada 1 CS/m a mais é 1 item grande por partida longa",
        fill=lambda ctx: {"role_label": ROLE_LABELS.get(ctx.main_role, ctx.main_role)},
        relevance=lambda ctx: (4.0 - ctx.eficiencia) / 4.0,
    ),

    # 2. Death cedo crônico
    Rule(
        id="early_death_prone",
        category="safety",
        priority=9,
        condition=lambda ctx: ctx.timing.get("avg_death_minute") is not None
                              and ctx.timing["avg_death_minute"] < 8,
        template="Você morre cedo em média (min {dm:.1f}) — prioriza champs com kit safe early (Tahm Kench, Malphite)",
        fill=lambda ctx: {"dm": ctx.timing["avg_death_minute"]},
        relevance=lambda ctx: (8 - ctx.timing["avg_death_minute"]) / 8,
    ),

    # 3. Delta de agressão W vs L alto
    Rule(
        id="delta_aggression_high",
        category="strength",
        priority=9,
        condition=lambda ctx: ctx.delta is not None and ctx.delta_confidence == "high"
                              and ctx.delta[0] > 3.0,
        template="Quando vence, sua Agressão sobe +{d:.1f} — champs como Kayn, Talon, Diana amplificam esse padrão",
        fill=lambda ctx: {"d": ctx.delta[0]},
        relevance=lambda ctx: min(1.0, ctx.delta[0] / 5.0),
    ),

    # 4. Visão baixa em elo alto
    Rule(
        id="low_vision_rank_mismatch",
        category="vision",
        priority=7,
        condition=lambda ctx: ctx.mapa < 4.0 and ctx.main_role in ("JUNGLE", "UTILITY"),
        template="Controle de mapa está em {m:.1f}/10 — em {role_label}, visão é o maior separador de elo. Control wards no river dão swing",
        fill=lambda ctx: {"m": ctx.mapa, "role_label": ROLE_LABELS.get(ctx.main_role, ctx.main_role)},
        relevance=lambda ctx: (4.0 - ctx.mapa) / 4.0,
    ),

    # 5. Scaling forte, early fraco
    Rule(
        id="scaling_hyper_carry",
        category="scaling",
        priority=7,
        condition=lambda ctx: ctx.scaling > 7.0 and ctx.early_pressure < 4.0,
        template="Teu perfil é de hyper-carry ({s:.1f} scaling, {e:.1f} early) — prolongue jogos, evita early trades",
        fill=lambda ctx: {"s": ctx.scaling, "e": ctx.early_pressure},
        relevance=lambda ctx: ctx.scaling / 10,
    ),

    # 6. Tilt após derrota
    Rule(
        id="tilt_after_loss",
        category="mental",
        priority=10,
        condition=lambda ctx: ctx.matches_after_loss_wr is not None
                              and ctx.matches_after_loss_wr < 0.35
                              and ctx.recent_count >= 10,
        template="Após uma derrota, seu WR cai pra {pct:.0f}% — considera pausa ou champ de conforto antes da próxima",
        fill=lambda ctx: {"pct": ctx.matches_after_loss_wr * 100},
        relevance=lambda ctx: 1.0 - ctx.matches_after_loss_wr,
    ),

    # 7. Pool pequeno = alvo fácil de ban
    Rule(
        id="champ_pool_small",
        category="pool",
        priority=5,
        condition=lambda ctx: ctx.champ_pool_size <= 3 and ctx.recent_count >= 15,
        template="Pool pequeno ({n} champs) — em elo mais alto, times banam. Vale ampliar com champs similares",
        fill=lambda ctx: {"n": ctx.champ_pool_size},
        relevance=lambda ctx: (4 - ctx.champ_pool_size) / 4,
    ),

    # 8. Duo forte
    Rule(
        id="duo_strong",
        category="social",
        priority=6,
        condition=lambda ctx: ctx.best_duo is not None
                              and ctx.best_duo.get("games", 0) >= 10
                              and ctx.best_duo.get("wr", 0) >= 0.65,
        template="{ally} é seu melhor duo ({wr:.0f}% em {g} jogos) — queue em sombra quando puder",
        fill=lambda ctx: {
            "ally": ctx.best_duo["ally_name"],
            "wr": ctx.best_duo["wr"] * 100,
            "g": ctx.best_duo["games"],
        },
        relevance=lambda ctx: ctx.best_duo["wr"],
    ),

    # 9. Early gold deficit crônico
    Rule(
        id="early_gold_deficit",
        category="laning",
        priority=8,
        condition=lambda ctx: ctx.timing.get("gold_diff_at_10") is not None
                              and ctx.timing["gold_diff_at_10"] < -300,
        template="Você está {g:.0f}g atrás aos 10 min em média — trocas mais cautelosas no early fazem diferença enorme",
        fill=lambda ctx: {"g": abs(ctx.timing["gold_diff_at_10"])},
        relevance=lambda ctx: min(1.0, abs(ctx.timing["gold_diff_at_10"]) / 600),
    ),

    # 10. Utilidade alta mas main role não é Sup
    Rule(
        id="utility_off_role",
        category="role",
        priority=4,
        condition=lambda ctx: ctx.utilidade > 7.0 and ctx.main_role not in ("UTILITY",),
        template="Sua Utilidade está em {u:.1f}/10 jogando {role_label} — vale testar Sup num smurf (provavelmente melhor WR)",
        fill=lambda ctx: {
            "u": ctx.utilidade,
            "role_label": ROLE_LABELS.get(ctx.main_role, ctx.main_role),
        },
        relevance=lambda ctx: ctx.utilidade / 10,
    ),
]

ROLE_LABELS = {"TOP": "Top", "JUNGLE": "Jungle", "MIDDLE": "Mid", "BOTTOM": "ADC", "UTILITY": "Suporte"}
```

---

### Step 6.5 — Engine: `generate_insights(ctx)`

**Arquivo:** `backend/services/insights/engine.py`.

```python
"""
engine.py — Avalia catálogo contra contexto, ranqueia por priority × relevance.
"""

from __future__ import annotations
from .context import PlayerContext
from .rules import CATALOG


def generate_insights(ctx: PlayerContext, top_n: int = 5) -> list[dict]:
    """
    Retorna top_n insights ranqueados.
    """
    candidates: list[dict] = []
    for rule in CATALOG:
        result = rule.evaluate(ctx)
        if result is None:
            continue
        # Score final = priority × relevance (ambos 0-10 / 0-1)
        result["score"] = result["priority"] * max(0.1, result["relevance"])
        candidates.append(result)

    # Ordena por score desc
    candidates.sort(key=lambda x: x["score"], reverse=True)

    return candidates[:top_n]
```

---

### Step 6.6 — Builder de `PlayerContext` a partir do DB

**Arquivo:** `backend/services/insights/engine.py` (mesmo arquivo).

```python
from collections import defaultdict

from ..stats_refs_cache import get_role_refs
from ..recommendation_service import _build_profile, _split_rows_by_outcome, _most_frequent_role


def build_context(db_client, puuid: str) -> PlayerContext | None:
    """Constrói um PlayerContext completo consultando o Supabase."""

    rows = (
        db_client.table("match_participants")
        .select("*")
        .eq("puuid", puuid)
        .order("id", desc=True)
        .limit(100)   # últimas 100 partidas max
        .execute()
        .data or []
    )
    if len(rows) < 10:
        return None  # sample insuficiente

    role_refs_all = get_role_refs(db_client)
    main_role = _most_frequent_role(rows)

    # Perfil 10D
    profile_all = _build_profile(rows, main_role, role_refs_all, puuid=puuid, db_client=db_client)

    # Split W/L
    wins_rows, losses_rows = _split_rows_by_outcome(rows)
    if len(wins_rows) >= 5 and len(losses_rows) >= 5:
        profile_wins = _build_profile(wins_rows, main_role, role_refs_all, puuid=puuid, db_client=db_client)
        profile_losses = _build_profile(losses_rows, main_role, role_refs_all, puuid=puuid, db_client=db_client)
        delta = [round(w - l, 2) for w, l in zip(profile_wins, profile_losses)]
        delta_confidence = "high"
    else:
        profile_wins = None
        profile_losses = None
        delta = None
        delta_confidence = "low" if len(wins_rows) > 0 and len(losses_rows) > 0 else "none"

    # Timing
    timing_row = (
        db_client.table("player_timing_profile")
        .select("*")
        .eq("puuid", puuid).eq("role", main_role)
        .order("patch", desc=True).limit(1)
        .execute().data or []
    )
    timing = timing_row[0] if timing_row else {}

    # Pool / top champ
    champ_counts: dict[str, dict] = defaultdict(lambda: {"games": 0, "wins": 0})
    for r in rows:
        c = r.get("champion_name")
        champ_counts[c]["games"] += 1
        if r.get("win"):
            champ_counts[c]["wins"] += 1
    pool_size = sum(1 for c in champ_counts.values() if c["games"] >= 3)
    top_champ = max(champ_counts.items(), key=lambda kv: kv[1]["games"])
    top_champ_name, top_champ_stats = top_champ if champ_counts else (None, None)
    top_champ_wr = (top_champ_stats["wins"] / top_champ_stats["games"]) if top_champ_stats else None

    # Matches após derrota
    sorted_rows = sorted(rows, key=lambda r: r.get("id") or 0)
    prev_loss = False
    after_loss = {"n": 0, "w": 0}
    for r in sorted_rows:
        if prev_loss:
            after_loss["n"] += 1
            if r.get("win"):
                after_loss["w"] += 1
        prev_loss = r.get("win") is False
    matches_after_loss_wr = (after_loss["w"] / after_loss["n"]) if after_loss["n"] >= 5 else None

    # Best duo (via endpoint já existente ou query direta — ajustar)
    best_duo = None
    try:
        duos = (
            db_client.rpc("player_frequent_allies", {"target_puuid": puuid, "min_games_val": 5})
            .execute().data or []
        )
        if duos:
            duos.sort(key=lambda d: (d["wins_together"]/d["games_together"], d["games_together"]), reverse=True)
            top = duos[0]
            best_duo = {
                "ally_name": f"{top['game_name']}#{top['tag_line']}",
                "games": top["games_together"],
                "wr": top["winrate"] / 100,
            }
    except Exception:
        pass

    return PlayerContext(
        puuid=puuid,
        main_role=main_role,
        patch=timing.get("patch"),
        profile_all=profile_all,
        profile_wins=profile_wins,
        profile_losses=profile_losses,
        delta=delta,
        delta_confidence=delta_confidence,
        timing=timing,
        role_refs=role_refs_all.get(main_role, {}),
        recent_count=len(rows),
        recent_winrate=sum(1 for r in rows if r.get("win")) / len(rows),
        matches_after_loss_wr=matches_after_loss_wr,
        champ_pool_size=pool_size,
        top_champ=top_champ_name,
        top_champ_winrate=top_champ_wr,
        best_duo=best_duo,
    )
```

---

### Step 6.7 — Endpoint `GET /api/v1/player/insights`

**Arquivo:** adicionar em `backend/api/routes/player.py`.

```python
from backend.services.insights.engine import build_context, generate_insights

@router.get("/insights")
def player_insights(puuid: str, top_n: int = Query(5, ge=1, le=10)):
    db = _get_supabase()
    ctx = build_context(db, puuid)
    if ctx is None:
        return {"insights": [], "reason": "sample_insuficient"}
    return {"insights": generate_insights(ctx, top_n=top_n)}
```

---

### Step 6.8 — UI no `/players/[puuid]`

**Substituir** o "Ask Metis teaser" atual por card "Insights Metis" que consome `/api/v1/player/insights`.

```tsx
const [insights, setInsights] = useState<Insight[]>([])

useEffect(() => {
  if (!resolvedPuuid) return
  apiFetch(`/api/v1/player/insights?puuid=${encodeURIComponent(resolvedPuuid)}`)
    .then(r => r.ok ? r.json() : { insights: [] })
    .then(d => setInsights(d.insights ?? []))
}, [resolvedPuuid])

// Render:
<Card accent>
  <SectionLabel icon="brain">Insights Metis</SectionLabel>
  {insights.length === 0 && (
    <p>Não há insights significativos — jogue mais partidas pra análise.</p>
  )}
  {insights.map(i => (
    <div key={i.id} style={{ borderLeft: `3px solid ${categoryColor(i.category)}`, padding: "8px 12px" }}>
      <div style={{ fontSize: 10, color: 'var(--m-muted)', textTransform: 'uppercase' }}>
        {i.category}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5 }}>{i.text}</p>
    </div>
  ))}
</Card>
```

---

### Step 6.9 — Testes unitários

`tests/test_insights.py`:

```python
from backend.services.insights.context import PlayerContext
from backend.services.insights.engine import generate_insights


def _ctx(**overrides):
    defaults = {
        "puuid": "test",
        "main_role": "JUNGLE",
        "patch": "16.7",
        "profile_all": [5]*10,
        "profile_wins": None,
        "profile_losses": None,
        "delta": None,
        "delta_confidence": "none",
        "timing": {},
        "role_refs": {},
        "recent_count": 20,
        "recent_winrate": 0.5,
    }
    defaults.update(overrides)
    return PlayerContext(**defaults)


def test_cs_below_role_avg_fires():
    ctx = _ctx(profile_all=[5,5,3.0,5,5,5,5,5,5,5], role_refs={"cs_per_minute":(6.0,1.0)})
    insights = generate_insights(ctx)
    ids = [i["id"] for i in insights]
    assert "cs_below_role_avg" in ids


def test_no_insights_when_average_player():
    ctx = _ctx(profile_all=[5]*10, role_refs={"cs_per_minute":(6.0,1.0)})
    insights = generate_insights(ctx)
    # Player médio não dispara nenhuma regra crítica
    assert all(i["priority"] < 8 for i in insights)


def test_tilt_after_loss_fires():
    ctx = _ctx(matches_after_loss_wr=0.25, recent_count=20)
    insights = generate_insights(ctx)
    assert "tilt_after_loss" in [i["id"] for i in insights]
```

---

## Critério de "done" da Fase 6

- [ ] 10 regras do catálogo + testes
- [ ] `PlayerContext` builder funciona com dados reais
- [ ] Endpoint `/api/v1/player/insights` responde 200
- [ ] Pra 3 players diferentes, insights são específicos e acionáveis
- [ ] UI no dashboard mostra insights com categoria colorida
- [ ] Testes unitários passam
- [ ] Patch notes atualizado

---

## Rollback

- Remover endpoint + UI do frontend → insights somem, volta pro teaser antigo
- Módulo `insights/` não precisa ser deletado — inócuo

---

## Patch notes sugerido

```markdown
## p-0.10.0-alpha.7 — Fase 6: Pensamento Crítico (YYYY-MM-DD)

Metis agora diagnostica — não só descreve. 10 regras analíticas geram insights prescritivos com números reais.

### Backend
- Módulo `backend/services/insights/`: `PlayerContext`, `Rule`, engine, catálogo
- 10 regras cobrindo: farming, vision, safety, aggression, mental (tilt), scaling, social, laning, pool, role

### Endpoint
- `GET /api/v1/player/insights?puuid=&top_n=` retorna insights ranqueados (priority × relevance)

### Frontend
- Card "Insights Metis" no player dashboard substitui teaser antigo
- Cores por categoria, texto específico (inclui números reais do perfil)
```
