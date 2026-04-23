# Fase 7 — IA Narrativa (Metis)

> **Objetivo:** a Metis (Gemini 2.5 Flash) consome **tudo** (perfil 10D + delta W/L + timing + insights + build contextual) e produz **análise narrativa em PT-BR**, com argumentação. Fecha o ciclo Neo-Artemis 2.0 e lança a **v0.9.0**.
>
> **Pré-requisitos:** Fases 1, 2, 3a, 6 (crítico). Fases 3b, 4, 5 são bônus que enriquecem mas não bloqueiam.
> **Custo estimado:** 2 dias.
> **Bloqueia:** lançamento v0.9.0.
> **Status:** Não iniciado.

---

## Decisões de design

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Modelo | `gemini-2.5-flash` (já integrado) | Baixo custo, baixa latência, qualidade suficiente pra narrativa |
| Formato de saída | 3–4 parágrafos de prosa (não bullets) | Conecta ideias em vez de listar |
| Idioma | PT-BR estrito | Guardrail já existe pro chat |
| Personalidade | Calma, analítica, nunca tóxica | Definida na p-0.9.0 |
| Gate | Premium (já tem infra) | Consome tokens do plano do user |
| Cache | 1h por puuid | Evita re-geração quando player abre o dashboard várias vezes |
| Rate limit | Reusa o contador de tokens do plano | Token consumo = já tem infra |
| Fallback se tokens esgotados | Mensagem amigável + insights determinísticos como backup | UX não quebra |

---

## Steps

### Step 7.1 — Montador de contexto pro prompt

**Arquivo:** `backend/services/ai_summary_service.py` (novo).

```python
"""
ai_summary_service.py — Gera análise narrativa do player via Gemini.

Depende de build_context (Fase 6) + generate_insights.
Prompt-engineering específico pra manter foco + personalidade Metis.
"""

from __future__ import annotations
import json
from typing import Any

from .insights.context import PlayerContext
from .insights.engine import build_context, generate_insights
from .recommendation_service import buscar_recomendacoes, DIMENSION_NAMES


def build_ai_prompt_payload(ctx: PlayerContext, recs: list[dict]) -> dict[str, Any]:
    """
    Transforma ctx + recomendações num dict estruturado pro LLM.
    Inclui só o que importa — evita prompt gigante que dilui foco.
    """
    return {
        "identidade": {
            "main_role": ctx.main_role,
            "recent_winrate": round(ctx.recent_winrate * 100, 1),
            "recent_count": ctx.recent_count,
            "top_champ": ctx.top_champ,
            "top_champ_winrate": round(ctx.top_champ_winrate * 100, 1) if ctx.top_champ_winrate else None,
            "champ_pool_size": ctx.champ_pool_size,
        },
        "perfil_dimensional": dict(zip(DIMENSION_NAMES, ctx.profile_all)),
        "delta_win_vs_loss": {
            "confidence": ctx.delta_confidence,
            "values": dict(zip(DIMENSION_NAMES, ctx.delta)) if ctx.delta else None,
        },
        "timing": {
            k: v for k, v in ctx.timing.items()
            if k in ("avg_death_minute", "gold_diff_at_10", "cs_diff_at_15",
                     "scaling_inflection_minute", "first_blood_rate")
            and v is not None
        },
        "insights_detectados": [
            {"id": i["id"], "category": i["category"], "text": i["text"]}
            for i in generate_insights(ctx, top_n=5)
        ],
        "recomendacoes_top3": [
            {
                "champion": r["champion"],
                "role": r["role_label"],
                "confidence": r["confidence"],
                "winrate_meta": r["winrate"],
                "times_played": r["times_played"],
                "reasons": r.get("reasons", [])[:2],
            }
            for r in recs[:3]
        ],
        "contexto_mental": {
            "matches_after_loss_winrate": round(ctx.matches_after_loss_wr * 100, 1)
                                           if ctx.matches_after_loss_wr else None,
            "best_duo": ctx.best_duo,
        },
    }
```

---

### Step 7.2 — Prompt template

**Dentro do mesmo arquivo:**

```python
AI_SUMMARY_PROMPT = """Você é a Metis — estrategista analítica de League of Legends. Sua personalidade: calma, precisa, humilde, nunca tóxica. Fala em português brasileiro, registro conversacional mas inteligente.

Recebeu o dossiê completo de um invocador abaixo em JSON. Gere uma análise em **3 a 4 parágrafos** de prosa corrida (não use listas/bullets). Estrutura sugerida:

1. **Identifica o padrão central** do jogador (ex: "você é um hyper-carry que depende de scaling" ou "jogo agressivo early mas cai em late"). Cita 1-2 números concretos do perfil.
2. **Aponta a tensão ou ponto forte mais relevante** — usando insights detectados ou o delta W/L. Seja específico (cite números).
3. **Propõe ação concreta** — um champ recomendado + uma mudança de hábito (ex: "testar Kayn na próxima sessão e focar em não gankar mid sem visão").
4. (Opcional) **Fecha com observação curta** sobre o contexto mental (tilt, duo) se houver sinal.

Regras rígidas:
- NUNCA julgue moralmente ("você joga mal", "está errado"). Só observe padrões.
- NUNCA invente números que não estão no JSON. Se não tiver o dado, não cite.
- NUNCA mencione outros jogos além de LoL.
- NUNCA use gírias tóxicas da comunidade ("hardstuck", "trollar", "noob").
- Não fale sobre a plataforma Metis em si — é análise do jogador, não do produto.

Dossiê:
```json
{payload_json}
```

Análise (3-4 parágrafos):"""
```

---

### Step 7.3 — Função principal `generate_ai_summary`

```python
import logging
import os
from google import genai

logger = logging.getLogger(__name__)

_client: Any = None


def _get_gemini():
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_KEY ausente")
        _client = genai.Client(api_key=api_key)
    return _client


def generate_ai_summary(db_client, puuid: str) -> dict[str, Any]:
    """
    Gera summary narrativo pra um puuid. Cacheia em player_ai_summaries.
    Retorna {summary, tokens_used, generated_at, source}.
    source = 'cache' | 'fresh' | 'fallback'.
    """
    # 1) Checa cache
    cached = (
        db_client.table("player_ai_summaries")
        .select("summary, tokens_used, generated_at")
        .eq("puuid", puuid)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
        .data or []
    )
    if cached:
        # Aceita cache de até 1h
        from datetime import datetime, timezone, timedelta
        gen_at = datetime.fromisoformat(cached[0]["generated_at"].replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - gen_at) < timedelta(hours=1):
            return {**cached[0], "source": "cache"}

    # 2) Context + recomendações
    ctx = build_context(db_client, puuid)
    if ctx is None:
        return {
            "summary": "Ainda não tenho dados suficientes sobre esse invocador. Pelo menos 10 partidas ranqueadas no banco.",
            "tokens_used": 0,
            "source": "fallback",
        }

    recs = buscar_recomendacoes(db_client, puuid, top_n=5, include_reasons=True)
    payload = build_ai_prompt_payload(ctx, recs)

    prompt = AI_SUMMARY_PROMPT.format(payload_json=json.dumps(payload, ensure_ascii=False, indent=2))

    # 3) Gemini call
    try:
        client = _get_gemini()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        summary = response.text.strip()
        tokens_used = int(getattr(response.usage_metadata, "total_token_count", 0))
    except Exception as err:
        logger.error(f"Gemini falhou pra {puuid}: {err}")
        # Fallback: lista os insights como texto corrido
        insights_text = "\n\n".join(i["text"] for i in payload["insights_detectados"][:3])
        return {
            "summary": f"Não consegui gerar a análise narrativa agora. Aqui vão os pontos principais que identifiquei:\n\n{insights_text}",
            "tokens_used": 0,
            "source": "fallback",
        }

    # 4) Cacheia
    db_client.table("player_ai_summaries").upsert({
        "puuid": puuid,
        "summary": summary,
        "tokens_used": tokens_used,
    }, on_conflict="puuid").execute()

    return {
        "summary": summary,
        "tokens_used": tokens_used,
        "source": "fresh",
    }
```

---

### Step 7.4 — Migration `008_create_player_ai_summaries.sql`

```sql
CREATE TABLE IF NOT EXISTS player_ai_summaries (
  puuid        TEXT PRIMARY KEY,
  summary      TEXT NOT NULL,
  tokens_used  INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE player_ai_summaries ENABLE ROW LEVEL SECURITY;

-- Leitura pública — não é info sensível (já é público via endpoint)
DROP POLICY IF EXISTS "player_ai_summaries_select_public" ON player_ai_summaries;
CREATE POLICY "player_ai_summaries_select_public"
  ON player_ai_summaries FOR SELECT TO public USING (true);
```

---

### Step 7.5 — Endpoint `GET /api/v1/player/ai-summary`

**Em `backend/api/routes/player.py`:**

```python
from backend.services.ai_summary_service import generate_ai_summary

@router.get("/ai-summary")
def player_ai_summary(
    puuid: str,
    supabase_token: str = Query(..., description="JWT do user autenticado"),
):
    """
    Gera summary narrativo (gated: premium).
    Consome tokens do plano do user.
    """
    db = _get_supabase()

    # Validar user + plano (reusar lógica do /chat)
    user = _validate_and_get_user(supabase_token)
    if not _is_premium(user):
        raise HTTPException(status_code=402, detail="Requer plano Doador ou superior")

    # Checa se o user tem tokens disponíveis
    remaining = _get_remaining_tokens(user.id)
    # Estimativa: summary consome ~1500 tokens (prompt + resposta)
    if remaining < 1500:
        raise HTTPException(status_code=429, detail={
            "error": "limite_diario",
            "tokens_remaining": remaining,
        })

    result = generate_ai_summary(db, puuid)

    # Debita tokens do plano
    if result["source"] == "fresh":
        _consume_tokens(user.id, result["tokens_used"])

    return result
```

> As funções `_validate_and_get_user`, `_is_premium`, `_get_remaining_tokens`, `_consume_tokens` já existem pra o `/chat` — reusar.

---

### Step 7.6 — UI no player dashboard

**`frontend/src/app/players/[puuid]/page.tsx`:** novo card **acima dos insights**.

```tsx
const [aiSummary, setAiSummary] = useState<{summary: string; source: string} | null>(null)
const [loadingAI, setLoadingAI] = useState(false)

async function handleGenerateAI() {
  setLoadingAI(true)
  const session = (await supabase.auth.getSession()).data.session
  if (!session) { setLoadingAI(false); return }
  const res = await apiFetch(
    `/api/v1/player/ai-summary?puuid=${encodeURIComponent(resolvedPuuid!)}&supabase_token=${session.access_token}`
  )
  if (res.ok) setAiSummary(await res.json())
  setLoadingAI(false)
}

// Render:
<Card accent>
  <SectionLabel icon="brain">Análise completa (IA)</SectionLabel>
  {!aiSummary && (
    <>
      <p style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
        A Metis gera uma análise narrativa profunda sobre seu padrão de jogo,
        usando perfil 10D, timings e contexto mental.
      </p>
      <button onClick={handleGenerateAI} disabled={loadingAI} className="m-hover-accent"
        style={{ marginTop: 10, padding: '10px 14px', background: 'var(--m-accent)', color: '#1a1510', borderRadius: 8, border: 'none', fontWeight: 600 }}>
        {loadingAI ? 'Gerando...' : 'Gerar análise (premium)'}
      </button>
    </>
  )}
  {aiSummary && (
    <div style={{ fontSize: 13, color: 'var(--m-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
      {aiSummary.summary}
      {aiSummary.source === 'cache' && (
        <div style={{ fontSize: 10, color: 'var(--m-muted)', marginTop: 10 }}>
          (gerado há menos de 1h — cacheado)
        </div>
      )}
    </div>
  )}
</Card>
```

**Gate visual:** se user não é premium, mostra CTA "Ver planos" em vez do botão.

---

### Step 7.7 — Validação de qualidade com 5 players

**Critério:** rodar `/ai-summary` pra 5 puuids distintos (diferentes roles, elos, estilos). Avaliar manualmente:

| Critério | Sim/Não |
|---|---|
| Menciona stats reais do perfil (número concreto) | |
| Referencia pelo menos 1 champ do top-3 recomendado | |
| Sugere ação concreta (não só "continue melhorando") | |
| Não inventa dado (ex: número de partidas errado) | |
| Tom calmo, não tóxico | |
| 3-4 parágrafos (não virou lista) | |

Se 4+ dos 6 critérios batem em 5/5 players, passa.
Se não, ajustar prompt (iterar 2-3 vezes).

---

### Step 7.8 — Telemetria básica

Logar em `player_ai_summaries` também:
- Quantas gerações por dia
- Tokens médios consumidos
- Taxa de cache hit

Query de monitor:
```sql
SELECT DATE(generated_at) as dia, count(*) as gens, avg(tokens_used) as avg_tokens
FROM player_ai_summaries
WHERE generated_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;
```

---

## Critério de "done" da Fase 7

- [ ] Migration 008 aplicada
- [ ] `ai_summary_service.py` funciona com Gemini
- [ ] Endpoint `/api/v1/player/ai-summary` retorna summary novo + cacheia
- [ ] Frontend mostra botão "Gerar análise" (premium) + render do texto
- [ ] Fallback quando Gemini indisponível: texto com insights determinísticos
- [ ] Token consumption debitado no plano corretamente
- [ ] Validação de qualidade com 5 players passa
- [ ] Patch notes atualizado
- [ ] **Lançamento v0.9.0** — changelog consolidado de todas as fases

---

## Rollback

- Reverter endpoint — UI mostra botão desativado ou some
- Cache em `player_ai_summaries` não incomoda se ficar

---

## Patch notes sugerido

```markdown
## v0.9.0 — Sistema Neo-Artemis 2.0 completo (YYYY-MM-DD)

🎉 **Maior atualização do sistema de recomendação desde o lançamento.**

Construído em 7 fases (p-0.10.0-alpha.0 → alpha.7) ao longo de [N semanas]. O sistema agora:

### Normalização real
- Perfil 8D → 10D com z-score contra média da role (Fase 1 + 3a)
- Player Sup com 2 kills não aparece mais como "não agressivo"

### Comportamento vencedor
- Split Win-vs-Loss revela o padrão de vitória do jogador (Fase 2)
- Recomendação prioriza champs que batem com o "eu vencedor"

### Dimensão temporal
- Timing via frames: scaling, early pressure, gold@10, cs@15 (Fase 3a)
- Events: death timing, first blood rate (Fase 3b)

### Semântica de classes
- 172 campeões classificados em 10 classes (curadoria manual)
- Composição inimiga computada por match (Fase 4)

### Build contextual
- Void Staff vs tank_heavy ≠ vs squishy_burst — winrate diferencial
- Endpoint `/builds/recommend` e `/builds/matchup` (Fase 5)

### Pensamento crítico
- 10+ regras determinísticas geram insights **prescritivos**
- "Seu CS/m é 5.8 vs média 7.1 da role — déficit de 18%" em vez de "Farming compatível" (Fase 6)

### IA narrativa
- Metis (Gemini 2.5 Flash) consome todo o contexto e gera análise de 3-4 parágrafos em PT-BR
- Gated premium, cacheado 1h (Fase 7)

### Agradecimentos
- Neo Artemis original (André, César, Takida, Willian) — base conceitual das 8 dimensões
- Riot Data Dragon — catálogo de champions/items
- Comunidade LoL BR — dataset que torna tudo isso possível
```

---

## Re-aval antes de começar

1. Prompt template está alinhado com a personalidade que tu quer pra Metis?
2. Estimativa de 1500 tokens por summary é razoável ou precisa ajustar?
3. Cache de 1h é OK ou deveria ser 24h (economizando mais)?
