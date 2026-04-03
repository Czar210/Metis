"""
test_funcionais_api_metis.py — Testes Funcionais — API Metis (M5)
Mapeado 1:1 ao checklist do plano_atual.md (César + Claude).

Seções:
  1. Health Check
  2. POST /api/v1/player/sync
  3. GET /api/v1/stats/champions
  4. POST /api/v1/player/update-history
  5. CORS & Exception Handling
"""

import os
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from riotwatcher import ApiError

os.environ.pop("CORS_ORIGINS", None)
os.environ.pop("RIOT_API_KEY", None)

from backend.main import app

client = TestClient(app, raise_server_exceptions=False)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _api_error(status_code: int) -> ApiError:
    err = ApiError(f"Mocked ApiError {status_code}")
    err.response = MagicMock()
    err.response.status_code = status_code
    return err


def _mock_stats_db(rows: list) -> MagicMock:
    mock = MagicMock()
    mock.table.return_value.select.return_value.ilike.return_value.execute.return_value.data = rows
    mock.table.return_value.select.return_value.ilike.return_value.eq.return_value.execute.return_value.data = rows
    return mock


def _stats_row(champion="Ahri", position="MIDDLE", win=True, version="14.10", server="BR1"):
    return {
        "champion_name": champion, "team_position": position, "win": win,
        "kills": 5, "deaths": 2, "assists": 8, "gold_earned": 12000,
        "damage_per_minute": 800.0, "kill_participation": 0.7,
        "matches": {"game_version": version, "queue_id": 420},
        "players": {"server": server},
    }


# ═════════════════════════════════════════════════════════════════════════════
# 1. Health Check
# ═════════════════════════════════════════════════════════════════════════════

class TestHealthCheck:
    def test_health_retorna_200_com_payload_correto(self):
        """GET /api/v1/health → 200 {"status": "online", "system": "Metis"}"""
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "online"
        assert data["system"] == "Metis"


# ═════════════════════════════════════════════════════════════════════════════
# 2. POST /api/v1/player/sync
# ═════════════════════════════════════════════════════════════════════════════

class TestPlayerSync:
    def test_request_valido_retorna_200(self):
        """{"riot_id":"Faker#KR1","server":"KR","count":5} → 200"""
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"novas": 5, "ignoradas": 0, "erros": 0}
            resp = client.post("/api/v1/player/sync",
                               json={"riot_id": "Faker#KR1", "server": "KR", "count": 5})
        assert resp.status_code == 200

    def test_sem_hash_retorna_400_formato_invalido(self):
        """Sem # no riot_id → 400 "Formato inválido" """
        resp = client.post("/api/v1/player/sync",
                           json={"riot_id": "FakerKR1", "server": "BR1", "count": 5})
        assert resp.status_code == 400
        assert "inválido" in resp.json()["detail"].lower() or "invalido" in resp.json()["detail"].lower()

    def test_nick_vazio_retorna_400(self):
        """{"riot_id":"#KR1"} → 400 "Nome e Tag não podem ser vazios" """
        resp = client.post("/api/v1/player/sync",
                           json={"riot_id": "#KR1", "server": "BR1", "count": 5})
        assert resp.status_code == 400
        assert "vazios" in resp.json()["detail"].lower()

    def test_tag_vazia_retorna_400(self):
        """{"riot_id":"Faker#"} → 400"""
        resp = client.post("/api/v1/player/sync",
                           json={"riot_id": "Faker#", "server": "BR1", "count": 5})
        assert resp.status_code == 400

    def test_ambos_vazios_retorna_400(self):
        """{"riot_id":"#"} → 400"""
        resp = client.post("/api/v1/player/sync",
                           json={"riot_id": "#", "server": "BR1", "count": 5})
        assert resp.status_code == 400


# ═════════════════════════════════════════════════════════════════════════════
# 3. GET /api/v1/stats/champions
# ═════════════════════════════════════════════════════════════════════════════

class TestStatsChampions:
    def test_champion_ahri_retorna_200(self):
        """?champion=Ahri → 200"""
        with patch("backend.api.routes.stats._get_supabase",
                   return_value=_mock_stats_db([_stats_row()])):
            resp = client.get("/api/v1/stats/champions?champion=Ahri")
        assert resp.status_code == 200

    def test_filtro_role_retorna_200(self):
        """?champion=Ahri&role=MIDDLE → 200 filtrado"""
        db = MagicMock()
        db.table.return_value.select.return_value.ilike.return_value.eq.return_value.execute.return_value.data = [_stats_row()]
        with patch("backend.api.routes.stats._get_supabase", return_value=db):
            resp = client.get("/api/v1/stats/champions?champion=Ahri&role=MIDDLE")
        assert resp.status_code == 200

    def test_filtro_server_retorna_200(self):
        """?champion=Ahri&server=BR1 → 200 filtrado"""
        with patch("backend.api.routes.stats._get_supabase",
                   return_value=_mock_stats_db([_stats_row(server="BR1")])):
            resp = client.get("/api/v1/stats/champions?champion=Ahri&server=BR1")
        assert resp.status_code == 200

    def test_filtro_elo_retorna_200_sem_erro(self):
        """?champion=Ahri&elo=DIAMOND → 200 (elo aceito, sem filtro real)"""
        with patch("backend.api.routes.stats._get_supabase",
                   return_value=_mock_stats_db([_stats_row()])):
            resp = client.get("/api/v1/stats/champions?champion=Ahri&elo=DIAMOND")
        assert resp.status_code == 200

    def test_filtro_patch_retorna_200(self):
        """?champion=Ahri&patch=14.5 → 200 filtrado"""
        with patch("backend.api.routes.stats._get_supabase",
                   return_value=_mock_stats_db([_stats_row(version="14.5")])):
            resp = client.get("/api/v1/stats/champions?champion=Ahri&patch=14.5")
        assert resp.status_code == 200

    def test_todos_filtros_combinados_retorna_200(self):
        """Todos os filtros combinados → 200"""
        with patch("backend.api.routes.stats._get_supabase",
                   return_value=_mock_stats_db([_stats_row(version="14.10", server="BR1")])):
            resp = client.get(
                "/api/v1/stats/champions?champion=Ahri&role=MIDDLE&server=BR1&patch=14.10&elo=DIAMOND"
            )
        assert resp.status_code == 200

    def test_min_matches_99999_retorna_200_com_total_zero(self):
        """min_matches=99999 → 200 com stats=None (total abaixo do mínimo)"""
        with patch("backend.api.routes.stats._get_supabase",
                   return_value=_mock_stats_db([_stats_row()])):
            resp = client.get("/api/v1/stats/champions?champion=Ahri&min_matches=99999")
        assert resp.status_code == 200
        assert resp.json()["stats"] is None

    def test_sem_champion_retorna_422(self):
        """Sem parâmetro champion → 422"""
        resp = client.get("/api/v1/stats/champions")
        assert resp.status_code == 422

    def test_champion_inexistente_retorna_200_com_total_zero(self):
        """?champion=XYZ (inexistente) → 200 com total_matches: 0"""
        with patch("backend.api.routes.stats._get_supabase",
                   return_value=_mock_stats_db([])):
            resp = client.get("/api/v1/stats/champions?champion=XYZ")
        data = resp.json()
        assert resp.status_code == 200
        assert data["total_matches"] == 0

    def test_min_matches_zero_retorna_422(self):
        """min_matches=0 → 422 (mínimo 1)"""
        resp = client.get("/api/v1/stats/champions?champion=Ahri&min_matches=0")
        assert resp.status_code == 422

    def test_champion_minusculo_retorna_200(self):
        """?champion=ahri (minúsculo) → 200 (ilike case-insensitive)"""
        with patch("backend.api.routes.stats._get_supabase",
                   return_value=_mock_stats_db([_stats_row()])):
            resp = client.get("/api/v1/stats/champions?champion=ahri")
        assert resp.status_code == 200


# ═════════════════════════════════════════════════════════════════════════════
# 4. POST /api/v1/player/update-history
# ═════════════════════════════════════════════════════════════════════════════

class TestUpdateHistory:
    def test_request_valido_retorna_200(self):
        """{"nick":"Faker","tag":"KR1","server":"KR","count":5} → 200"""
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"novas": 5, "ignoradas": 0, "erros": 0}
            resp = client.post("/api/v1/player/update-history",
                               json={"nick": "Faker", "tag": "KR1", "server": "KR", "count": 5})
        assert resp.status_code == 200

    def test_nick_vazio_riot_nao_encontra_retorna_404(self):
        """Nick vazio → Riot API 404 → HTTPException 404"""
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.side_effect = _api_error(404)
            resp = client.post("/api/v1/player/update-history",
                               json={"nick": "", "tag": "BR1", "server": "BR1", "count": 5})
        assert resp.status_code == 404

    def test_count_zero_retorna_422(self):
        """Count = 0 → 422"""
        resp = client.post("/api/v1/player/update-history",
                           json={"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 0})
        assert resp.status_code == 422

    def test_count_25_retorna_422(self):
        """Count = 25 → 422 (máximo 20)"""
        resp = client.post("/api/v1/player/update-history",
                           json={"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 25})
        assert resp.status_code == 422

    def test_servidor_invalido_retorna_500(self):
        """Servidor inválido "XYZ" → 500 (ValueError de _get_routing_region)"""
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.side_effect = ValueError("Servidor desconhecido: 'XYZ'")
            resp = client.post("/api/v1/player/update-history",
                               json={"nick": "Faker", "tag": "BR1", "server": "XYZ", "count": 5})
        assert resp.status_code == 500

    def test_sem_riot_api_key_retorna_500(self):
        """Sem RIOT_API_KEY → 500 RuntimeError"""
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.side_effect = RuntimeError("RIOT_API_KEY não encontrada no .env")
            resp = client.post("/api/v1/player/update-history",
                               json={"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 5})
        assert resp.status_code == 500
        assert "detail" in resp.json()


# ═════════════════════════════════════════════════════════════════════════════
# 5. CORS & Exception Handling
# ═════════════════════════════════════════════════════════════════════════════

class TestCORSEExceptionHandling:
    def test_localhost_3000_aceito(self):
        """Request de localhost:3000 → aceito (Access-Control-Allow-Origin presente)"""
        resp = client.get("/api/v1/health",
                          headers={"Origin": "http://localhost:3000"})
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_origem_nao_permitida_bloqueada(self):
        """Request de origem não permitida → sem header CORS (bloqueado)"""
        resp = client.get("/api/v1/health",
                          headers={"Origin": "http://evil.com"})
        assert "access-control-allow-origin" not in resp.headers

    def test_supabase_indisponivel_retorna_500_sem_crash(self):
        """Supabase indisponível → erro claro 500, sem crash"""
        with patch("backend.api.routes.stats._get_supabase") as mock:
            mock.side_effect = RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
            resp = client.get("/api/v1/stats/champions?champion=Ahri")
        assert resp.status_code == 500
        assert resp.json() is not None  # não crashou, retornou JSON

    def test_riot_api_429_retorna_mensagem_amigavel(self):
        """Riot API 429 (rate limit) → 429 com mensagem legível"""
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.side_effect = _api_error(429)
            resp = client.post("/api/v1/player/update-history",
                               json={"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 5})
        assert resp.status_code == 429
        assert "detail" in resp.json()
        assert len(resp.json()["detail"]) > 0

    def test_riot_api_403_retorna_502_com_detalhe(self):
        """Riot API 403 (key expirada) → 502 com detail legível (não é crash nem 500 genérico)"""
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.side_effect = _api_error(403)
            resp = client.post("/api/v1/player/update-history",
                               json={"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 5})
        assert resp.status_code == 502
        data = resp.json()
        assert "detail" in data
        assert len(data["detail"]) > 0
