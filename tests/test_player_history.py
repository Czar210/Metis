"""
test_player_history.py — Testes do endpoint GET /api/v1/player/history

Cobre:
  - Paginação (offset, limit, has_more)
  - Campos retornados (novos campos v0.6.4: total_cs, cs_per_minute, items, rune_keystone…)
  - Validação de parâmetros
  - Tratamento de erros
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_participant(match_id="BR1_123", win=True):
    return {
        "champion_name": "Ahri",
        "team_position": "MIDDLE",
        "team_id": 100,
        "win": win,
        "kills": 5,
        "deaths": 2,
        "assists": 8,
        "gold_earned": 12000,
        "total_damage_dealt_to_champions": 25000,
        "vision_score": 20,
        "kill_participation": 0.65,
        "damage_per_minute": 750.0,
        "total_cs": 180,
        "cs_per_minute": 7.5,
        "champion_level": 18,
        "items": [3157, 3165, 3089, 3020, 4645, 3135, 3364],
        "rune_keystone": 8214,
        "summoner1_id": 4,
        "summoner2_id": 14,
        "matches": {
            "match_id": match_id,
            "game_version": "14.10",
            "game_duration": 1800,
            "queue_id": 420,
            "end_type": "normal",
            "created_at": "2026-04-01T20:00:00Z",
        },
    }


def _mock_db(rows: list, limit: int = 15) -> MagicMock:
    """Monta uma cadeia de mocks compatível com o select do player.py."""
    mock = MagicMock()
    (
        mock.table.return_value
        .select.return_value
        .eq.return_value
        .order.return_value
        .range.return_value
        .execute.return_value
        .data
    ) = rows
    return mock


# ── Caminho Feliz ─────────────────────────────────────────────────────────────

class TestPlayerHistoryHappyPath:

    def test_retorna_200_com_estrutura_correta(self):
        rows = [_make_participant(f"BR1_{i}") for i in range(5)]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc-123")
        assert resp.status_code == 200
        data = resp.json()
        assert "puuid" in data
        assert "matches" in data
        assert "offset" in data
        assert "limit" in data
        assert "has_more" in data

    def test_puuid_presente_no_retorno(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=meu-puuid")
        assert resp.json()["puuid"] == "meu-puuid"

    def test_matches_e_lista(self):
        rows = [_make_participant(f"BR1_{i}") for i in range(3)]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        assert isinstance(resp.json()["matches"], list)
        assert len(resp.json()["matches"]) == 3


# ── Paginação ─────────────────────────────────────────────────────────────────

class TestPlayerHistoryPaginacao:

    def test_has_more_true_quando_retorna_exatamente_limit(self):
        """Se retornar exatamente `limit` linhas, has_more deve ser True."""
        rows = [_make_participant(f"BR1_{i}") for i in range(15)]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc&limit=15")
        assert resp.json()["has_more"] is True

    def test_has_more_false_quando_retorna_menos_que_limit(self):
        """Se retornar menos de `limit` linhas, has_more deve ser False."""
        rows = [_make_participant(f"BR1_{i}") for i in range(7)]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc&limit=15")
        assert resp.json()["has_more"] is False

    def test_has_more_false_lista_vazia(self):
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db([])):
            resp = client.get("/api/v1/player/history?puuid=abc")
        assert resp.json()["has_more"] is False
        assert resp.json()["matches"] == []

    def test_offset_refletido_na_resposta(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc&offset=10")
        assert resp.json()["offset"] == 10

    def test_limit_refletido_na_resposta(self):
        rows = [_make_participant(f"BR1_{i}") for i in range(10)]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc&limit=10")
        assert resp.json()["limit"] == 10

    def test_limit_default_15(self):
        rows = []
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        assert resp.json()["limit"] == 15

    def test_offset_default_0(self):
        rows = []
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        assert resp.json()["offset"] == 0


# ── Campos Enriquecidos (v0.6.4) ─────────────────────────────────────────────

class TestPlayerHistoryCamposEnriquecidos:

    def test_participant_tem_total_cs(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        match = resp.json()["matches"][0]
        assert "total_cs" in match
        assert match["total_cs"] == 180

    def test_participant_tem_cs_per_minute(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        match = resp.json()["matches"][0]
        assert "cs_per_minute" in match
        assert match["cs_per_minute"] == 7.5

    def test_participant_tem_items_lista(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        match = resp.json()["matches"][0]
        assert "items" in match
        assert isinstance(match["items"], list)
        assert len(match["items"]) == 7

    def test_participant_tem_rune_keystone(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        match = resp.json()["matches"][0]
        assert "rune_keystone" in match
        assert match["rune_keystone"] == 8214

    def test_participant_tem_champion_level(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        match = resp.json()["matches"][0]
        assert match["champion_level"] == 18

    def test_participant_tem_team_id(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        match = resp.json()["matches"][0]
        assert match["team_id"] == 100

    def test_matches_tem_nested_match_data(self):
        """O campo `matches` dentro de cada participante deve conter os metadados da partida."""
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc")
        match = resp.json()["matches"][0]
        meta = match["matches"]
        assert "match_id" in meta
        assert "game_version" in meta
        assert "game_duration" in meta
        assert "queue_id" in meta
        assert "end_type" in meta
        assert "created_at" in meta


# ── Validação de Parâmetros ───────────────────────────────────────────────────

class TestPlayerHistoryValidacao:

    def test_sem_puuid_retorna_422(self):
        resp = client.get("/api/v1/player/history")
        assert resp.status_code == 422

    def test_limit_abaixo_de_1_retorna_422(self):
        resp = client.get("/api/v1/player/history?puuid=abc&limit=0")
        assert resp.status_code == 422

    def test_limit_acima_de_50_retorna_422(self):
        resp = client.get("/api/v1/player/history?puuid=abc&limit=51")
        assert resp.status_code == 422

    def test_offset_negativo_retorna_422(self):
        resp = client.get("/api/v1/player/history?puuid=abc&offset=-1")
        assert resp.status_code == 422

    def test_limit_1_valido(self):
        rows = [_make_participant()]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc&limit=1")
        assert resp.status_code == 200

    def test_limit_50_valido(self):
        rows = [_make_participant(f"BR1_{i}") for i in range(10)]
        with patch("backend.api.routes.player._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/player/history?puuid=abc&limit=50")
        assert resp.status_code == 200


# ── Tratamento de Erros ───────────────────────────────────────────────────────

class TestPlayerHistoryErros:

    def test_supabase_indisponivel_retorna_500(self):
        with patch("backend.api.routes.player._get_supabase") as mock:
            mock.side_effect = RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
            resp = client.get("/api/v1/player/history?puuid=abc")
        assert resp.status_code == 500
        assert "detail" in resp.json()

    def test_erro_generico_retorna_500(self):
        mock_db = MagicMock()
        (
            mock_db.table.return_value
            .select.return_value
            .eq.return_value
            .order.return_value
            .range.return_value
            .execute.side_effect
        ) = Exception("Conexão recusada")
        with patch("backend.api.routes.player._get_supabase", return_value=mock_db):
            resp = client.get("/api/v1/player/history?puuid=abc")
        assert resp.status_code == 500


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
