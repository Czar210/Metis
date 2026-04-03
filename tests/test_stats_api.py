"""
test_stats_api.py — Testes do endpoint GET /api/v1/stats/champions
Cobre: caminho feliz, filtros, edge cases, validação e aggregação via mock.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

# ── Mock base para o Supabase ────────────────────────────────────────────────

def _make_row(champion="Ahri", position="MIDDLE", win=True, kills=5, deaths=2,
              assists=8, gold=12000, dpm=800.0, kp=0.7, version="14.10", server="BR1"):
    return {
        "champion_name": champion,
        "team_position": position,
        "win": win,
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
        "gold_earned": gold,
        "damage_per_minute": dpm,
        "kill_participation": kp,
        "matches": {"game_version": version, "queue_id": 420},
        "players": {"server": server},
    }


def _mock_db(rows: list) -> MagicMock:
    """Retorna um db_client mockado que responde com `rows`."""
    mock = MagicMock()
    mock.table.return_value.select.return_value.ilike.return_value.eq.return_value.execute.return_value.data = rows
    mock.table.return_value.select.return_value.ilike.return_value.execute.return_value.data = rows
    return mock


# ── Caminho feliz ────────────────────────────────────────────────────────────

class TestChampionStatsHappyPath:
    def test_caminho_feliz_200(self):
        rows = [_make_row() for _ in range(5)]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/stats/champions?champion=Ahri")
        assert resp.status_code == 200

    def test_retorna_campos_obrigatorios(self):
        rows = [_make_row(win=True), _make_row(win=False)]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            data = client.get("/api/v1/stats/champions?champion=Ahri").json()
        assert "champion" in data
        assert "total_matches" in data
        assert "stats" in data

    def test_winrate_calculado_corretamente(self):
        # 3 vitórias em 4 partidas → 75.0%
        rows = [_make_row(win=True)] * 3 + [_make_row(win=False)]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            data = client.get("/api/v1/stats/champions?champion=Ahri").json()
        assert data["stats"]["winrate"] == 75.0

    def test_total_matches_correto(self):
        rows = [_make_row() for _ in range(7)]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            data = client.get("/api/v1/stats/champions?champion=Ahri").json()
        assert data["total_matches"] == 7

    def test_champion_case_insensitive(self):
        """?champion=ahri (minúsculo) deve funcionar via ilike."""
        rows = [_make_row()]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/stats/champions?champion=ahri")
        assert resp.status_code == 200


# ── Filtros opcionais ────────────────────────────────────────────────────────

class TestChampionStatsFilters:
    def test_filtro_role(self):
        resp_mock = MagicMock()
        resp_mock.data = [_make_row()]
        mock_db = MagicMock()
        # Com role, o builder adiciona .eq()
        (mock_db.table.return_value.select.return_value
         .ilike.return_value.eq.return_value.execute.return_value) = resp_mock

        with patch("backend.api.routes.stats._get_supabase", return_value=mock_db):
            resp = client.get("/api/v1/stats/champions?champion=Ahri&role=MIDDLE")
        assert resp.status_code == 200

    def test_filtro_server(self):
        rows_br = [_make_row(server="BR1")] * 3
        rows_na = [_make_row(server="NA1")] * 2
        # Mock retorna todos; filtro Python deve manter só BR1
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows_br + rows_na)):
            data = client.get("/api/v1/stats/champions?champion=Ahri&server=BR1").json()
        assert data["total_matches"] == 3

    def test_filtro_patch(self):
        rows_14 = [_make_row(version="14.10")] * 4
        rows_15 = [_make_row(version="15.1")] * 2
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows_14 + rows_15)):
            data = client.get("/api/v1/stats/champions?champion=Ahri&patch=14.10").json()
        assert data["total_matches"] == 4

    def test_filtro_elo_aceito_sem_erro(self):
        """elo é aceito mas não filtra — não deve causar 422 nem 500."""
        rows = [_make_row()]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            resp = client.get("/api/v1/stats/champions?champion=Ahri&elo=DIAMOND")
        assert resp.status_code == 200

    def test_todos_filtros_combinados(self):
        rows = [_make_row(version="14.10", server="BR1")]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            resp = client.get(
                "/api/v1/stats/champions?champion=Ahri&role=MIDDLE&server=BR1&patch=14.10&elo=DIAMOND"
            )
        assert resp.status_code == 200


# ── Edge cases ───────────────────────────────────────────────────────────────

class TestChampionStatsEdgeCases:
    def test_campeao_inexistente_retorna_total_zero(self):
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db([])):
            data = client.get("/api/v1/stats/champions?champion=XYZ").json()
        assert data["total_matches"] == 0
        assert data["stats"] is None

    def test_min_matches_muito_alto_retorna_stats_none(self):
        rows = [_make_row() for _ in range(3)]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            data = client.get("/api/v1/stats/champions?champion=Ahri&min_matches=99999").json()
        assert data["stats"] is None

    def test_min_matches_exato_retorna_stats(self):
        rows = [_make_row() for _ in range(5)]
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows)):
            data = client.get("/api/v1/stats/champions?champion=Ahri&min_matches=5").json()
        assert data["stats"] is not None

    def test_server_case_insensitive(self):
        rows_br = [_make_row(server="BR1")] * 2
        with patch("backend.api.routes.stats._get_supabase", return_value=_mock_db(rows_br)):
            data = client.get("/api/v1/stats/champions?champion=Ahri&server=br1").json()
        assert data["total_matches"] == 2


# ── Validação ────────────────────────────────────────────────────────────────

class TestChampionStatsValidation:
    def test_sem_champion_retorna_422(self):
        resp = client.get("/api/v1/stats/champions")
        assert resp.status_code == 422

    def test_min_matches_zero_retorna_422(self):
        resp = client.get("/api/v1/stats/champions?champion=Ahri&min_matches=0")
        assert resp.status_code == 422

    def test_min_matches_negativo_retorna_422(self):
        resp = client.get("/api/v1/stats/champions?champion=Ahri&min_matches=-1")
        assert resp.status_code == 422
