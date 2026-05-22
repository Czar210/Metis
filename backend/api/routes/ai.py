"""
ai.py — Endpoints de IA da Metis (prefixo: /api/ai)

Endpoints:
  POST /api/ai/match-analysis   -> MatchAnalysis (cache 7d, free gate)
  POST /api/ai/inline-insight   -> AIInsight[]   (cache 24h)
  POST /api/ai/chat             -> SSE streaming
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI"])


# ── Helpers de autenticacao ────────────────────────────────────────────────────

def _get_user(token: str | None) -> tuple[str, str]:
    """Retorna (tier, user_id) ou levanta 401."""
    if not token:
        raise HTTPException(status_code=401, detail="Login necessario para usar IA.")
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        sb = create_client(url, key)
        result = sb.auth.get_user(token)
        user = result.user
        if not user:
            raise HTTPException(status_code=401, detail="Token invalido.")
        tier = (user.app_metadata or {}).get("tier", "free")
        return tier, str(user.id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"[ai] _get_user falhou: {exc}")
        raise HTTPException(status_code=401, detail="Falha na autenticacao.")


def _fetch_match_participants(match_id: str) -> list[dict]:
    """Busca participantes completos de uma partida no Supabase."""
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    db = create_client(url, key)
    result = (
        db.table("match_participants")
        .select(
            "puuid, champion_name, team_position, team_id, win, "
            "kills, deaths, assists, gold_earned, "
            "total_damage_dealt_to_champions, vision_score, "
            "kill_participation, cs_per_minute, "
            "players(game_name, tag_line), "
            "matches(match_id, game_version, game_duration)"
        )
        .eq("match_id", match_id)
        .execute()
    )
    return result.data or []


def _compute_metis_score(participants: list[dict]) -> None:
    """Calcula metis_score in-place (espelho de match.py)."""
    n = len(participants)
    if not n:
        return

    def s(v) -> float:
        return float(v) if v else 0.0

    avg_gold = sum(s(p.get("gold_earned")) for p in participants) / n or 1
    avg_vis  = sum(s(p.get("vision_score")) for p in participants) / n or 1
    avg_cspm = sum(s(p.get("cs_per_minute")) for p in participants) / n or 1

    team_dmg: dict[int, float] = {}
    for p in participants:
        tid = p.get("team_id", 0)
        team_dmg[tid] = team_dmg.get(tid, 0) + s(p.get("total_damage_dealt_to_champions"))

    _ROLE_W = {
        "TOP":     {"kda": 0.25, "dmg": 0.15, "gold": 0.20, "vis": 0.05, "cs": 0.15, "kp": 0.10},
        "JUNGLE":  {"kda": 0.25, "dmg": 0.10, "gold": 0.10, "vis": 0.15, "cs": 0.10, "kp": 0.25},
        "MIDDLE":  {"kda": 0.25, "dmg": 0.20, "gold": 0.20, "vis": 0.05, "cs": 0.20, "kp": 0.25},
        "BOTTOM":  {"kda": 0.25, "dmg": 0.30, "gold": 0.25, "vis": 0.05, "cs": 0.25, "kp": 0.10},
        "UTILITY": {"kda": 0.25, "dmg": 0.05, "gold": 0.05, "vis": 0.30, "cs": 0.05, "kp": 0.25},
    }
    _DEF = {"kda": 0.20, "dmg": 0.15, "gold": 0.15, "vis": 0.15, "cs": 0.15, "kp": 0.15}

    for p in participants:
        kills = s(p.get("kills")); deaths = s(p.get("deaths")); assists = s(p.get("assists"))
        gold = s(p.get("gold_earned")); damage = s(p.get("total_damage_dealt_to_champions"))
        vision = s(p.get("vision_score")); cspm = s(p.get("cs_per_minute")); kp = s(p.get("kill_participation"))
        w = _ROLE_W.get((p.get("team_position") or "UNKNOWN").upper(), _DEF)
        t_dmg = team_dmg.get(p.get("team_id", 0), 1) or 1
        raw = (
            w["kda"]  * min((kills + assists) / max(deaths, 1) / 5.0, 1.0)
            + w["dmg"]  * min(damage / t_dmg / 0.3, 1.0)
            + w["gold"] * min(gold / avg_gold / 1.5, 1.0)
            + w["vis"]  * min(vision / avg_vis / 1.5, 1.0)
            + w["cs"]   * (min(cspm / avg_cspm / 1.5, 1.0) if avg_cspm > 0 else 0)
            + w["kp"]   * min(kp / 0.7, 1.0)
        )
        p["metis_score"] = round(raw * 100, 1)


def _extract_json(raw: str) -> dict | list:
    """Extrai JSON do raw (remove code fences se existirem)."""
    # Tenta pelo primeiro { ou [ ate o ultimo } ou ]
    for open_c, close_c in [('{', '}'), ('[', ']')]:
        start = raw.find(open_c)
        end = raw.rfind(close_c)
        if start != -1 and end > start:
            candidate = raw[start:end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue
    raise ValueError(f"Nenhum JSON valido encontrado na resposta do LLM: {raw[:200]}")


def _apply_free_gate(analysis: dict) -> dict:
    """Aplica blur nos campos extras para usuarios free (C4)."""
    gated = dict(analysis)
    # Mantém só o primeiro strength e primeiro weakness; demais viram None
    strengths = gated.get("strengths") or []
    weaknesses = gated.get("weaknesses") or []
    key_moments = gated.get("keyMoments") or []
    gated["strengths"] = strengths[:1] + [None] * max(0, len(strengths) - 1)
    gated["weaknesses"] = weaknesses[:1] + [None] * max(0, len(weaknesses) - 1)
    gated["keyMoments"] = key_moments[:1] + [None] * max(0, len(key_moments) - 1)
    gated["coaching"] = None
    gated["_gated"] = True
    return gated


# ── POST /api/ai/match-analysis ───────────────────────────────────────────────

class MatchAnalysisRequest(BaseModel):
    matchId: str
    puuid: str
    supabase_token: str
    locale: str = "pt"


@router.post("/match-analysis")
def match_analysis(req: MatchAnalysisRequest):
    """
    Analise profunda de uma partida para um jogador especifico.
    Cache 7 dias. Free gate: apenas 1 strength + 1 weakness + 1 keyMoment visiveis.
    """
    from backend.core.ai_cache import get_cached, make_hash, set_cached
    from backend.core.token_guard import check_limit, update_monthly_usage, get_usage_summary
    from backend.app.ai.prompts.match_analysis import MATCH_ANALYSIS_SYSTEM, build_match_analysis_prompt
    from backend.services.llm_adapter import get_llm

    tier, user_id = _get_user(req.supabase_token)

    # Cache check (antes de verificar limite — cache nao consome tokens)
    cache_key = make_hash({"matchId": req.matchId, "puuid": req.puuid, "locale": req.locale})
    cached = get_cached("match_analysis", cache_key)
    if cached:
        analysis = cached["response"]
        if tier == "free":
            analysis = _apply_free_gate(analysis)
        return {
            "analysis": analysis,
            "cached": True,
            "usage": get_usage_summary(user_id, tier),
        }

    # Verifica limite mensal
    check_limit(user_id, tier)

    # Busca dados da partida
    participants = _fetch_match_participants(req.matchId)
    if not participants:
        raise HTTPException(status_code=404, detail=f"Partida '{req.matchId}' nao encontrada.")

    _compute_metis_score(participants)

    target = next((p for p in participants if p.get("puuid") == req.puuid), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"PUUID nao encontrado nesta partida.")

    # Gera analise
    try:
        prompt = build_match_analysis_prompt(req.matchId, participants, req.puuid, locale=req.locale)
        llm = get_llm()
        llm_result = llm.generate(prompt, system_prompt=MATCH_ANALYSIS_SYSTEM)
    except Exception as exc:
        logger.error(f"[match-analysis] LLM falhou: {exc}")
        raise HTTPException(status_code=502, detail="Falha ao gerar analise. Tente novamente.")

    # Extrai e valida JSON
    try:
        analysis = _extract_json(llm_result.text)
    except Exception:
        logger.error(f"[match-analysis] JSON invalido: {llm_result.text[:300]}")
        raise HTTPException(status_code=502, detail="Resposta do modelo invalida. Tente novamente.")

    # Persiste cache (7 dias)
    set_cached("match_analysis", cache_key, analysis, llm_result.tokens_used, ttl_days=7)

    # Atualiza uso de tokens
    update_monthly_usage(user_id, llm_result.tokens_used)

    if tier == "free":
        analysis = _apply_free_gate(analysis)

    return {
        "analysis": analysis,
        "cached": False,
        "usage": get_usage_summary(user_id, tier),
    }


# ── POST /api/ai/inline-insight ───────────────────────────────────────────────

class InlineInsightRequest(BaseModel):
    scope: str          # 'match' | 'player' | 'champion'
    id: str             # matchId, puuid ou champion_name
    context: dict = {}  # dados pre-computados passados pelo frontend
    supabase_token: str


@router.post("/inline-insight")
def inline_insight(req: InlineInsightRequest):
    """
    Insight compacto (1-2 bullets) para match, player ou champion.
    Cache 24h. Disponivel para todos os tiers com quota mensal.
    """
    from backend.core.ai_cache import get_cached, make_hash, set_cached
    from backend.core.token_guard import check_limit, update_monthly_usage, get_usage_summary
    from backend.app.ai.prompts.inline_insight import INLINE_INSIGHT_SYSTEM, build_inline_insight_prompt
    from backend.services.llm_adapter import get_llm

    if req.scope not in ("match", "player", "champion"):
        raise HTTPException(status_code=422, detail="scope deve ser 'match', 'player' ou 'champion'.")

    tier, user_id = _get_user(req.supabase_token)

    # Cache check
    cache_key = make_hash({"scope": req.scope, "id": req.id, "context": req.context})
    cached = get_cached("inline_insight", cache_key)
    if cached:
        return {
            "insights": cached["response"],
            "cached": True,
            "usage": get_usage_summary(user_id, tier),
        }

    check_limit(user_id, tier)

    try:
        prompt = build_inline_insight_prompt(req.scope, req.context)
        llm = get_llm()
        llm_result = llm.generate(prompt, system_prompt=INLINE_INSIGHT_SYSTEM)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error(f"[inline-insight] LLM falhou: {exc}")
        raise HTTPException(status_code=502, detail="Falha ao gerar insight. Tente novamente.")

    try:
        insights = _extract_json(llm_result.text)
        if not isinstance(insights, list):
            insights = [insights]
    except Exception:
        logger.error(f"[inline-insight] JSON invalido: {llm_result.text[:300]}")
        raise HTTPException(status_code=502, detail="Resposta do modelo invalida. Tente novamente.")

    set_cached("inline_insight", cache_key, insights, llm_result.tokens_used, ttl_days=1)
    update_monthly_usage(user_id, llm_result.tokens_used)

    return {
        "insights": insights,
        "cached": False,
        "usage": get_usage_summary(user_id, tier),
    }


# ── POST /api/ai/chat (SSE) ───────────────────────────────────────────────────

class ChatRequest(BaseModel):
    sessionId: str
    message: str
    supabase_token: str
    context: dict | None = None  # { type: 'match'|'event', id: str }


@router.post("/chat")
def ai_chat(req: ChatRequest):
    """
    Chat SSE com guardrail de topico e limite mensal de tokens.
    Response: text/event-stream com deltas JSON por chunk.
    """
    from backend.core.token_guard import check_limit, update_monthly_usage, MONTHLY_LIMITS
    from backend.services.llm_adapter import get_llm, is_lol_related, GUARDRAIL_REJECTION, METIS_SYSTEM_PROMPT

    tier, user_id = _get_user(req.supabase_token)
    check_limit(user_id, tier)

    llm = get_llm()

    # Guardrail de topico (sync, barato)
    related, guard_tokens = is_lol_related(req.message, llm)
    if not related:
        update_monthly_usage(user_id, max(guard_tokens, 30))
        def _rejection_stream() -> Iterator[str]:
            yield f"data: {json.dumps({'delta': GUARDRAIL_REJECTION})}\n\n"
            yield f"data: {json.dumps({'done': True, 'usage': {'tokens_used': max(guard_tokens, 30), 'status': 'off_topic'}})}\n\n"
        return StreamingResponse(_rejection_stream(), media_type="text/event-stream")

    def _stream() -> Iterator[str]:
        total_tokens = 0
        try:
            for chunk in llm.generate_stream(req.message, system_prompt=METIS_SYSTEM_PROMPT):
                if chunk.startswith("__tokens__"):
                    total_tokens = int(chunk.replace("__tokens__", "") or 0)
                else:
                    yield f"data: {json.dumps({'delta': chunk})}\n\n"
        except Exception as exc:
            logger.error(f"[ai/chat] stream falhou: {exc}")
            yield f"data: {json.dumps({'error': 'Erro no streaming. Tente novamente.'})}\n\n"
            return

        tokens_total = max(total_tokens, guard_tokens + 50)
        update_monthly_usage(user_id, tokens_total)
        limit = MONTHLY_LIMITS.get(tier, 0)
        used_after = tokens_total  # aproximado; get_monthly_usage adicionaria uma query extra
        yield f"data: {json.dumps({'done': True, 'usage': {'tokens_used': used_after, 'token_limit': limit}})}\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")
