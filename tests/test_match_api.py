"""
test_match_api.py — Testes do endpoint GET /api/v1/match/{match_id}

Cobre:
  - Caminho feliz: estrutura da resposta (meta, blue_team, red_team, has_timeline, max_damage)
  - Split correto por team_id (100 → blue, 200 → red)
  - max_damage calculado corretamente
  - has_timeline: True quando match_timelines tem row; False quando não
  - 404 quando partida não encontrada
  - 500 em falha do Supabase
"""

import os
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

MATCH_ID = "BR1_999999999"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_participant(puuid, team_id, damage=20000, win=True):
    return {
        "puuid": puuid,
        "champion_name": "Ahri",
        "team_position": "MIDDLE",
        "team_id": team_id,
        "win": win,
        "kills": 5,
        "deaths": 2,
        "assists": 8,
        "gold_earned": 12000,
        "total_damage_dealt_to_champions": damage,
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
        "players": {"game_name": "Teste", "tag_line": "BR1"},
        "matches": {
            "match_id": MATCH_ID,
            "game_version": "14.10",
            "game_duration": 1800,
            "queue_id": 420,
            "end_type": "normal",
            "created_at": "2026-04-01T20:00:00Z",
        },
    }


def _five_per_team():
    """Retorna 10 participantes: 5 blue + 5 red."""
    blue = [_make_participant(f"puuid-blue-{i}", team_id=100, damage=20000 + i * 1000) for i in range(5)]
    red  = [_make_participant(f"puuid-red-{i}",  team_id=200, damage=15000 + i * 500,  win=False) for i in range(5)]
    return blue + red


def _mock_db(participants, has_timeline=False):
    db = MagicMock()

    # Primeira query: match_participants
    (
        db.table.return_value
        .select.return_value
        .eq.return_value
        .execute.return_value
        .data
    ) = participants

    # Segunda query: match_timelines (maybe_single)
    tl_data = {"match_id": MATCH_ID} if has_timeline else None
    (
        db.table.return_value
        .select.return_value
        .eq.return_value
        .maybe_single.return_value
        .execute.return_value
        .data
    ) = tl_data

    return db


# ── Caminho Feliz ─────────────────────────────────────────────────────────────

class TestMatchDetailsHappyPath:

    def test_retorna_200(self):
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.status_code == 200

    def test_estrutura_da_resposta(self):
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        data = resp.json()
        assert "match_id" in data
        assert "meta" in data
        assert "has_timeline" in data
        assert "max_damage" in data
        assert "blue_team" in data
        assert "red_team" in data

    def test_match_id_na_resposta(self):
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.json()["match_id"] == MATCH_ID

    def test_meta_contem_campos_da_partida(self):
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        meta = resp.json()["meta"]
        assert "match_id" in meta
        assert "game_version" in meta
        assert "game_duration" in meta
        assert "queue_id" in meta
        assert "end_type" in meta


# ── Split Blue / Red ──────────────────────────────────────────────────────────

class TestMatchDetailsSplit:

    def test_blue_team_tem_5_jogadores(self):
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert len(resp.json()["blue_team"]) == 5

    def test_red_team_tem_5_jogadores(self):
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert len(resp.json()["red_team"]) == 5

    def test_blue_team_todos_team_id_100(self):
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        for p in resp.json()["blue_team"]:
            assert p["team_id"] == 100

    def test_red_team_todos_team_id_200(self):
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        for p in resp.json()["red_team"]:
            assert p["team_id"] == 200

    def test_total_20_participantes_divididos_corretamente(self):
        """Soma de blue + red deve ser o total de participantes."""
        participants = _five_per_team()
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        data = resp.json()
        assert len(data["blue_team"]) + len(data["red_team"]) == len(participants)


# ── max_damage ────────────────────────────────────────────────────────────────

class TestMatchDetailsMaxDamage:

    def test_max_damage_e_o_maior_dano(self):
        """max_damage deve ser o valor máximo de total_damage_dealt_to_champions."""
        participants = [
            _make_participant("p1", 100, damage=30000),
            _make_participant("p2", 100, damage=20000),
            _make_participant("p3", 200, damage=25000, win=False),
        ]
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.json()["max_damage"] == 30000

    def test_max_damage_um_participante(self):
        participants = [_make_participant("p1", 100, damage=15000)]
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.json()["max_damage"] == 15000

    def test_max_damage_nao_e_zero_quando_dano_nulo(self):
        """Se damage for None em todos, max_damage não deve ser 0 de forma a causar divisão por zero."""
        participants = [
            {**_make_participant("p1", 100, damage=0), "total_damage_dealt_to_champions": None},
        ]
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.json()["max_damage"] >= 1


# ── has_timeline ──────────────────────────────────────────────────────────────

class TestMatchDetailsTimeline:

    def test_has_timeline_true_quando_existe(self):
        participants = [_make_participant("p1", 100)]
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants, has_timeline=True)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.json()["has_timeline"] is True

    def test_has_timeline_false_quando_nao_existe(self):
        participants = [_make_participant("p1", 100)]
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants, has_timeline=False)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.json()["has_timeline"] is False


# ── Dados dos Jogadores ───────────────────────────────────────────────────────

class TestMatchDetailsJogadores:

    def test_participant_tem_player_info(self):
        participants = [_make_participant("p1", 100)]
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        player = resp.json()["blue_team"][0]
        assert "players" in player
        assert player["players"]["game_name"] == "Teste"

    def test_participant_tem_items(self):
        participants = [_make_participant("p1", 100)]
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        player = resp.json()["blue_team"][0]
        assert "items" in player
        assert isinstance(player["items"], list)

    def test_participant_tem_rune_keystone(self):
        participants = [_make_participant("p1", 100)]
        with patch("backend.api.routes.match._get_supabase", return_value=_mock_db(participants)):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        player = resp.json()["blue_team"][0]
        assert player["rune_keystone"] == 8214


# ── Tratamento de Erros ───────────────────────────────────────────────────────

class TestMatchDetailsErros:

    def test_partida_inexistente_retorna_404(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        with patch("backend.api.routes.match._get_supabase", return_value=db):
            resp = client.get("/api/v1/match/BR1_NAOEXISTE")
        assert resp.status_code == 404
        assert "detail" in resp.json()

    def test_supabase_indisponivel_retorna_500(self):
        with patch("backend.api.routes.match._get_supabase") as mock:
            mock.side_effect = RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.status_code == 500
        assert "detail" in resp.json()

    def test_erro_generico_retorna_500(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("timeout")
        with patch("backend.api.routes.match._get_supabase", return_value=db):
            resp = client.get(f"/api/v1/match/{MATCH_ID}")
        assert resp.status_code == 500


# ── Timeline — helpers ────────────────────────────────────────────────────────

PUUIDS = [f"puuid-{i:03d}" for i in range(10)]

def _make_frames(puuids=None):
    puuids = puuids or PUUIDS[:2]
    return [
        {
            "t_ms": 60000 * m,
            "t_min": m,
            "p": {p: {"cs": m * 8, "cspm": 8.0, "gold": 500 + m * 200, "level": min(m + 1, 18), "xp": m * 100}
                  for p in puuids},
        }
        for m in range(3)
    ]


def _make_raw_frames(puuids=None):
    """Formato bruto da Riot API para timeline."""
    puuids = puuids or PUUIDS[:2]
    frames = []
    for m in range(3):
        participant_frames = {
            str(i + 1): {
                "minionsKilled": m * 6,
                "jungleMinionsKilled": m * 2,
                "totalGold": 500 + m * 200,
                "level": min(m + 1, 18),
                "xp": m * 100,
            }
            for i, _ in enumerate(puuids)
        }
        frames.append({"timestamp": 60000 * m, "participantFrames": participant_frames})
    return frames


def _mock_timeline_db(frames=None, has_participants=True, server="BR1"):
    """Mock do Supabase para o endpoint /timeline."""
    db = MagicMock()

    timeline_mock = MagicMock()
    participants_mock = MagicMock()

    def table_side_effect(table_name):
        if table_name == "match_timelines":
            return timeline_mock
        if table_name == "match_participants":
            return participants_mock
        return MagicMock()

    db.table.side_effect = table_side_effect

    # match_timelines — cache check (maybe_single) e upsert
    tl_data = {"frames": frames} if frames is not None else None
    (
        timeline_mock
        .select.return_value
        .eq.return_value
        .maybe_single.return_value
        .execute.return_value
        .data
    ) = tl_data
    timeline_mock.upsert.return_value.execute.return_value = MagicMock()

    # match_participants — busca server
    p_data = [{"players": {"server": server}}] if has_participants else []
    (
        participants_mock
        .select.return_value
        .eq.return_value
        .limit.return_value
        .execute.return_value
        .data
    ) = p_data

    return db


def _mock_lol_watcher(puuids=None, riot_error=None):
    """Mock do LolWatcher para o endpoint /timeline."""
    puuids = puuids or PUUIDS
    lol = MagicMock()
    if riot_error:
        lol.match.by_id.side_effect = riot_error
        lol.match.timeline_by_match.side_effect = riot_error
    else:
        lol.match.by_id.return_value = {"metadata": {"participants": puuids}}
        lol.match.timeline_by_match.return_value = {
            "info": {"frames": _make_raw_frames(puuids[:2])}
        }
    return lol


# ── Timeline — testes ─────────────────────────────────────────────────────────

class TestMatchTimeline:

    def test_cache_hit_retorna_200(self):
        frames = _make_frames()
        db = _mock_timeline_db(frames=frames)
        with patch("backend.api.routes.match._get_supabase", return_value=db):
            resp = client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        assert resp.status_code == 200

    def test_cache_hit_retorna_frames(self):
        frames = _make_frames()
        db = _mock_timeline_db(frames=frames)
        with patch("backend.api.routes.match._get_supabase", return_value=db):
            resp = client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        data = resp.json()
        assert data["match_id"] == MATCH_ID
        assert len(data["frames"]) == len(frames)

    def test_cache_hit_nao_chama_riot_api(self):
        frames = _make_frames()
        db = _mock_timeline_db(frames=frames)
        with patch("backend.api.routes.match._get_supabase", return_value=db), \
             patch("backend.api.routes.match.LolWatcher") as mock_lol:
            client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        mock_lol.assert_not_called()

    def test_cache_miss_chama_riot_api(self):
        db = _mock_timeline_db(frames=None)
        lol = _mock_lol_watcher()
        with patch("backend.api.routes.match._get_supabase", return_value=db), \
             patch("backend.api.routes.match.LolWatcher", return_value=lol), \
             patch.dict("os.environ", {"RIOT_API_KEY": "fake-key"}):
            resp = client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        assert resp.status_code == 200
        lol.match.by_id.assert_called_once()
        lol.match.timeline_by_match.assert_called_once()

    def test_cache_miss_salva_no_banco(self):
        db = _mock_timeline_db(frames=None)
        lol = _mock_lol_watcher()
        with patch("backend.api.routes.match._get_supabase", return_value=db), \
             patch("backend.api.routes.match.LolWatcher", return_value=lol), \
             patch.dict("os.environ", {"RIOT_API_KEY": "fake-key"}):
            client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        db.table("match_timelines").upsert.assert_called_once()

    def test_cache_miss_retorna_frames_parseados(self):
        db = _mock_timeline_db(frames=None)
        lol = _mock_lol_watcher(puuids=PUUIDS)
        with patch("backend.api.routes.match._get_supabase", return_value=db), \
             patch("backend.api.routes.match.LolWatcher", return_value=lol), \
             patch.dict("os.environ", {"RIOT_API_KEY": "fake-key"}):
            resp = client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        data = resp.json()
        assert "frames" in data
        assert len(data["frames"]) == 3  # 3 frames no mock
        frame = data["frames"][1]
        assert "t_min" in frame
        assert "t_ms" in frame
        assert "p" in frame

    def test_partida_inexistente_retorna_404(self):
        db = _mock_timeline_db(frames=None, has_participants=False)
        with patch("backend.api.routes.match._get_supabase", return_value=db):
            resp = client.get("/api/v1/match/BR1_NAOEXISTE/timeline")
        assert resp.status_code == 404

    def test_sem_server_retorna_422(self):
        db = _mock_timeline_db(frames=None, server=None)
        with patch("backend.api.routes.match._get_supabase", return_value=db):
            resp = client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        assert resp.status_code == 422

    def test_sem_riot_key_retorna_500(self):
        db = _mock_timeline_db(frames=None)
        env = {k: v for k, v in os.environ.items() if k != "RIOT_API_KEY"}
        with patch("backend.api.routes.match._get_supabase", return_value=db), \
             patch.dict("os.environ", env, clear=True):
            resp = client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        assert resp.status_code == 500

    def test_riot_api_error_retorna_502(self):
        from riotwatcher import ApiError
        from unittest.mock import MagicMock as MM
        db = _mock_timeline_db(frames=None)
        lol = MagicMock()
        # ApiError requer response mock
        resp_mock = MM()
        resp_mock.status_code = 429
        resp_mock.json.return_value = {}
        lol.match.by_id.side_effect = ApiError(resp_mock)
        with patch("backend.api.routes.match._get_supabase", return_value=db), \
             patch("backend.api.routes.match.LolWatcher", return_value=lol), \
             patch.dict("os.environ", {"RIOT_API_KEY": "fake-key"}):
            resp = client.get(f"/api/v1/match/{MATCH_ID}/timeline")
        assert resp.status_code == 502


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
