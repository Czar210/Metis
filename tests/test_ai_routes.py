"""
test_ai_routes.py — Testes dos endpoints /api/ai/*

Cobre:
  1. match-analysis happy path: retorna MatchAnalysis valido
  2. match-analysis cache hit: nao chama LLM na segunda requisicao
  3. match-analysis free gate: tier free recebe resposta com campos bloqueados
  4. match-analysis 429: limite mensal esgotado
  5. match-analysis 404: partida inexistente
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

MATCH_ID = "BR1_999000001"
PUUID_TARGET = "puuid-blue-0"
TOKEN_VALID = "valid-supabase-token"

_SAMPLE_ANALYSIS = {
    "tldr": "Voce dominou o early com 3 ganks, mas sumiu no late.",
    "score": 82.0,
    "strengths": [
        {"label": "Farming", "value": "8.2 CS/min", "note": "Acima da media do elo."},
        {"label": "Visao", "value": "38 wards", "note": "Top 10% do elo."},
    ],
    "weaknesses": [
        {"label": "Mortes no late", "value": "5 mortes", "note": "Muda o resultado da partida."},
    ],
    "keyMoments": [
        {"t": 180, "title": "First Blood", "analysis": "Gank certeiro no top.", "impact": "positive"},
        {"t": 900, "title": "Drake perdido", "analysis": "Time disperso, perdeu visao.", "impact": "negative"},
        {"t": 1500, "title": "Baron steal", "analysis": "Smite perfeito virou o jogo.", "impact": "positive"},
    ],
    "coaching": {"drill": "Kiting no Practice Tool", "goal": "Sobreviver fights", "estimated_minutes": 15},
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_participant(puuid, team_id, win=True):
    return {
        "puuid": puuid,
        "champion_name": "Jinx",
        "team_position": "BOTTOM",
        "team_id": team_id,
        "win": win,
        "kills": 8, "deaths": 2, "assists": 5,
        "gold_earned": 14000,
        "total_damage_dealt_to_champions": 25000,
        "vision_score": 30,
        "kill_participation": 0.65,
        "cs_per_minute": 8.2,
        "players": {"game_name": "Teste", "tag_line": "BR1"},
        "matches": {"match_id": MATCH_ID, "game_version": "14.10", "game_duration": 1800},
    }


def _ten_participants():
    blue = [_make_participant(f"puuid-blue-{i}", 100, win=True) for i in range(5)]
    red  = [_make_participant(f"puuid-red-{i}",  200, win=False) for i in range(5)]
    return blue + red


def _mock_user(tier: str = "premium"):
    user = MagicMock()
    user.app_metadata = {"tier": tier}
    user.id = "user-uuid-1234"
    auth_result = MagicMock()
    auth_result.user = user
    return auth_result


def _mock_llm_result(text: str, tokens: int = 1800):
    result = MagicMock()
    result.text = text
    result.tokens_used = tokens
    return result


# ── Teste 1: happy path ───────────────────────────────────────────────────────

def test_match_analysis_happy_path():
    """POST /api/ai/match-analysis retorna MatchAnalysis valido para tier premium."""
    with (
        patch("backend.api.routes.ai._get_user", return_value=("premium", "user-uuid-1234")),
        patch("backend.core.ai_cache.get_cached", return_value=None),
        patch("backend.core.ai_cache.set_cached"),
        patch("backend.core.token_guard.check_limit", return_value=500),
        patch("backend.core.token_guard.update_monthly_usage"),
        patch("backend.core.token_guard.get_usage_summary", return_value={"tokens_used": 2385, "token_limit": 50000, "pct": 4.8, "resets_at": "..."}),
        patch("backend.api.routes.ai._fetch_match_participants", return_value=_ten_participants()),
        patch("backend.services.llm_adapter.get_llm") as mock_get_llm,
    ):
        mock_llm = MagicMock()
        mock_llm.generate.return_value = _mock_llm_result(json.dumps(_SAMPLE_ANALYSIS))
        mock_get_llm.return_value = mock_llm

        resp = client.post(
            "/api/ai/match-analysis",
            json={"matchId": MATCH_ID, "puuid": PUUID_TARGET, "supabase_token": TOKEN_VALID},
            headers={"X-API-Key": "test"},  # conftest.py garante METIS_API_KEY=test
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "analysis" in body
    assert body["cached"] is False
    analysis = body["analysis"]
    assert "tldr" in analysis
    assert "score" in analysis
    assert isinstance(analysis.get("strengths"), list)
    assert isinstance(analysis.get("weaknesses"), list)
    assert isinstance(analysis.get("keyMoments"), list)
    assert analysis.get("coaching") is not None


# ── Teste 2: cache hit ────────────────────────────────────────────────────────

def test_match_analysis_cache_hit():
    """Segunda requisicao identica retorna cache sem chamar o LLM."""
    cached_data = {"response": _SAMPLE_ANALYSIS, "tokens_used": 1800, "computed_at": "2026-05-20T00:00:00Z"}

    with (
        patch("backend.api.routes.ai._get_user", return_value=("premium", "user-uuid-1234")),
        patch("backend.core.ai_cache.get_cached", return_value=cached_data),
        patch("backend.core.token_guard.get_usage_summary", return_value={"tokens_used": 1800, "token_limit": 50000, "pct": 3.6, "resets_at": "..."}),
        patch("backend.services.llm_adapter.get_llm") as mock_get_llm,
    ):
        resp = client.post(
            "/api/ai/match-analysis",
            json={"matchId": MATCH_ID, "puuid": PUUID_TARGET, "supabase_token": TOKEN_VALID},
            headers={"X-API-Key": "test"},  # conftest.py garante METIS_API_KEY=test
        )
        # LLM nao deve ter sido chamado
        mock_get_llm.assert_not_called()

    assert resp.status_code == 200
    assert resp.json()["cached"] is True


# ── Teste 3: free gate ────────────────────────────────────────────────────────

def test_match_analysis_free_gate():
    """Tier free recebe strengths/weaknesses/keyMoments com campos extras bloqueados (None)."""
    with (
        patch("backend.api.routes.ai._get_user", return_value=("free", "user-uuid-free")),
        patch("backend.core.ai_cache.get_cached", return_value=None),
        patch("backend.core.ai_cache.set_cached"),
        patch("backend.core.token_guard.check_limit", return_value=0),
        patch("backend.core.token_guard.update_monthly_usage"),
        patch("backend.core.token_guard.get_usage_summary", return_value={"tokens_used": 1800, "token_limit": 1000, "pct": 180.0, "resets_at": "..."}),
        patch("backend.api.routes.ai._fetch_match_participants", return_value=_ten_participants()),
        patch("backend.services.llm_adapter.get_llm") as mock_get_llm,
    ):
        mock_llm = MagicMock()
        mock_llm.generate.return_value = _mock_llm_result(json.dumps(_SAMPLE_ANALYSIS))
        mock_get_llm.return_value = mock_llm

        resp = client.post(
            "/api/ai/match-analysis",
            json={"matchId": MATCH_ID, "puuid": PUUID_TARGET, "supabase_token": TOKEN_VALID},
            headers={"X-API-Key": "test"},  # conftest.py garante METIS_API_KEY=test
        )

    assert resp.status_code == 200
    analysis = resp.json()["analysis"]
    assert analysis.get("_gated") is True
    # Primeiro item visivel, restantes None
    strengths = analysis["strengths"]
    assert strengths[0] is not None
    assert all(s is None for s in strengths[1:])
    # coaching bloqueado
    assert analysis["coaching"] is None


# ── Teste 4: 429 limite esgotado ─────────────────────────────────────────────

def test_match_analysis_token_limit_exceeded():
    """Retorna 429 quando o usuario atingiu o limite mensal."""
    from fastapi import HTTPException

    with (
        patch("backend.api.routes.ai._get_user", return_value=("premium", "user-uuid-1234")),
        patch("backend.core.ai_cache.get_cached", return_value=None),
        patch("backend.core.token_guard.check_limit", side_effect=HTTPException(
            status_code=429,
            detail="Limite mensal de 50,000 tokens atingido.",
        )),
    ):
        resp = client.post(
            "/api/ai/match-analysis",
            json={"matchId": MATCH_ID, "puuid": PUUID_TARGET, "supabase_token": TOKEN_VALID},
            headers={"X-API-Key": "test"},  # conftest.py garante METIS_API_KEY=test
        )

    assert resp.status_code == 429
    assert "Limite mensal" in resp.json()["detail"]


# ── Teste 5: 404 partida inexistente ─────────────────────────────────────────

def test_match_analysis_match_not_found():
    """Retorna 404 quando a partida nao existe no banco."""
    with (
        patch("backend.api.routes.ai._get_user", return_value=("premium", "user-uuid-1234")),
        patch("backend.core.ai_cache.get_cached", return_value=None),
        patch("backend.core.token_guard.check_limit", return_value=0),
        patch("backend.api.routes.ai._fetch_match_participants", return_value=[]),
    ):
        resp = client.post(
            "/api/ai/match-analysis",
            json={"matchId": "BR1_NAO_EXISTE", "puuid": PUUID_TARGET, "supabase_token": TOKEN_VALID},
            headers={"X-API-Key": "test"},  # conftest.py garante METIS_API_KEY=test
        )

    assert resp.status_code == 404
