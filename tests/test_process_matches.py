"""
Testes do pipeline process_matches.py (Bronze → Prata).
Cobre: filtros de limpeza, normalização e persistência com mock.
"""
import pytest
from unittest.mock import MagicMock, patch
from scripts.processing.process_matches import (
    extrair_dados_partida,
    processar_partida,
    _normalizar_patch,
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixture base — partida ranked válida com 10 participantes
# ─────────────────────────────────────────────────────────────────────────────

def make_participant(puuid: str, position: str = "MIDDLE", bot: bool = False) -> dict:
    return {
        "puuid": puuid,
        "riotIdGameName": f"Player_{puuid[:4]}",
        "riotIdTagline": "BR1",
        "championName": "Ahri",
        "teamPosition": position,
        "win": True,
        "kills": 5, "deaths": 2, "assists": 8,
        "goldEarned": 12000,
        "totalDamageDealtToChampions": 25000,
        "damageDealtToBuildings": 1000,
        "totalTimeCCDealt": 300,
        "visionScore": 25,
        "timePlayed": 1800,
        "teamEarlySurrendered": False,
        "botPlayer": bot,
        "challenges": {"soloKills": 2, "damagePerMinute": 800.0, "killParticipation": 0.7},
    }


def make_match(
    duration: int = 1800,
    queue_id: int = 420,
    n_participants: int = 10,
    game_version: str = "14.10.123.456",
    early_ff: bool = False,
    late_ff: bool = False,
) -> dict:
    participants = [make_participant(f"puuid_{i:04d}") for i in range(n_participants)]
    return {
        "metadata": {"matchId": "BR1_TEST_001"},
        "info": {
            "gameDuration": duration,
            "queueId": queue_id,
            "gameVersion": game_version,
            "gameEndedInEarlySurrender": early_ff,
            "gameEndedInSurrender": late_ff,
            "participants": participants,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Normalização de patch
# ─────────────────────────────────────────────────────────────────────────────

class TestNormalizarPatch:
    def test_versao_completa(self):
        assert _normalizar_patch("14.10.123.456") == "14.10"

    def test_versao_curta(self):
        assert _normalizar_patch("14.10") == "14.10"

    def test_versao_vazia(self):
        assert _normalizar_patch("") == "unknown"

    def test_versao_none(self):
        assert _normalizar_patch(None) == "unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Filtro 1: Duração
# ─────────────────────────────────────────────────────────────────────────────

class TestFiltroDuracao:
    def test_remake_descartado(self):
        match, _, _ = extrair_dados_partida(make_match(duration=180))
        assert match is None

    def test_exatamente_190s_aceito(self):
        match, _, _ = extrair_dados_partida(make_match(duration=190))
        assert match is not None

    def test_partida_normal_aceita(self):
        match, _, _ = extrair_dados_partida(make_match(duration=1800))
        assert match is not None


# ─────────────────────────────────────────────────────────────────────────────
# Filtro 2: Queue
# ─────────────────────────────────────────────────────────────────────────────

class TestFiltroQueue:
    def test_ranked_solo_aceito(self):
        match, _, _ = extrair_dados_partida(make_match(queue_id=420))
        assert match is not None

    def test_ranked_flex_aceito(self):
        match, _, _ = extrair_dados_partida(make_match(queue_id=440))
        assert match is not None

    def test_aram_descartado(self):
        match, _, _ = extrair_dados_partida(make_match(queue_id=450))
        assert match is None

    def test_normal_descartado(self):
        match, _, _ = extrair_dados_partida(make_match(queue_id=400))
        assert match is None

    def test_arena_descartado(self):
        match, _, _ = extrair_dados_partida(make_match(queue_id=1700))
        assert match is None

    def test_queue_id_salvo_no_payload(self):
        match, _, _ = extrair_dados_partida(make_match(queue_id=420))
        assert match["queue_id"] == 420


# ─────────────────────────────────────────────────────────────────────────────
# Filtro 3: Número de participantes
# ─────────────────────────────────────────────────────────────────────────────

class TestFiltroParticipantes:
    def test_10_participantes_aceito(self):
        match, _, _ = extrair_dados_partida(make_match(n_participants=10))
        assert match is not None

    def test_9_participantes_descartado(self):
        match, _, _ = extrair_dados_partida(make_match(n_participants=9))
        assert match is None

    def test_0_participantes_descartado(self):
        match, _, _ = extrair_dados_partida(make_match(n_participants=0))
        assert match is None


# ─────────────────────────────────────────────────────────────────────────────
# Filtro 4: Bots
# ─────────────────────────────────────────────────────────────────────────────

class TestFiltroBots:
    def test_bot_ignorado_partida_salva(self):
        """Partida com 1 bot entre 10 — bot ignorado, restantes salvos."""
        match_json = make_match()
        match_json["info"]["participants"][0]["botPlayer"] = True
        match, players, parts = extrair_dados_partida(match_json)
        assert match is not None
        assert all(p["puuid"] != "puuid_0000" for p in players)
        assert len(players) == 9

    def test_puuid_bot_prefix_ignorado(self):
        match_json = make_match()
        match_json["info"]["participants"][0]["puuid"] = "BOT_abc123"
        match, players, _ = extrair_dados_partida(match_json)
        assert match is not None
        assert all(not p["puuid"].startswith("BOT_") for p in players)

    def test_puuid_vazio_ignorado(self):
        match_json = make_match()
        match_json["info"]["participants"][0]["puuid"] = ""
        match, players, _ = extrair_dados_partida(match_json)
        assert match is not None
        assert all(p["puuid"] for p in players)


# ─────────────────────────────────────────────────────────────────────────────
# Filtro 5: teamPosition vazia
# ─────────────────────────────────────────────────────────────────────────────

class TestFiltroTeamPosition:
    def test_posicao_vazia_vira_unknown(self):
        match_json = make_match()
        match_json["info"]["participants"][0]["teamPosition"] = ""
        _, _, parts = extrair_dados_partida(match_json)
        assert parts[0]["team_position"] == "UNKNOWN"

    def test_posicao_none_vira_unknown(self):
        match_json = make_match()
        match_json["info"]["participants"][0]["teamPosition"] = None
        _, _, parts = extrair_dados_partida(match_json)
        assert parts[0]["team_position"] == "UNKNOWN"

    def test_posicao_valida_mantida(self):
        match_json = make_match()
        match_json["info"]["participants"][0]["teamPosition"] = "JUNGLE"
        _, _, parts = extrair_dados_partida(match_json)
        assert parts[0]["team_position"] == "JUNGLE"


# ─────────────────────────────────────────────────────────────────────────────
# Normalização de gameVersion
# ─────────────────────────────────────────────────────────────────────────────

class TestGameVersion:
    def test_version_normalizada(self):
        match, _, _ = extrair_dados_partida(make_match(game_version="14.10.123.456"))
        assert match["game_version"] == "14.10"

    def test_version_diferente(self):
        match, _, _ = extrair_dados_partida(make_match(game_version="15.1.500.100"))
        assert match["game_version"] == "15.1"


# ─────────────────────────────────────────────────────────────────────────────
# end_type
# ─────────────────────────────────────────────────────────────────────────────

class TestEndType:
    def test_normal(self):
        match, _, _ = extrair_dados_partida(make_match())
        assert match["end_type"] == "normal"

    def test_early_ff(self):
        match, _, _ = extrair_dados_partida(make_match(early_ff=True))
        assert match["end_type"] == "early_ff"

    def test_late_ff(self):
        match, _, _ = extrair_dados_partida(make_match(late_ff=True))
        assert match["end_type"] == "late_ff"


# ─────────────────────────────────────────────────────────────────────────────
# processar_partida com mock Supabase
# ─────────────────────────────────────────────────────────────────────────────

class TestProcessarPartida:
    def test_partida_valida_salva(self):
        mock_db = MagicMock()
        ok = processar_partida(make_match(), db_client=mock_db)
        assert ok is True
        mock_db.table.assert_any_call("matches")
        mock_db.table.assert_any_call("players")
        mock_db.table.assert_any_call("match_participants")

    def test_partida_invalida_nao_salva(self):
        """Remake não deve tocar no banco."""
        mock_db = MagicMock()
        ok = processar_partida(make_match(duration=100), db_client=mock_db)
        assert ok is False
        mock_db.table.assert_not_called()

    def test_upsert_chamado(self):
        mock_db = MagicMock()
        processar_partida(make_match(), db_client=mock_db)
        assert mock_db.table().upsert().execute.called

    def test_partida_corrompida_nao_salva(self):
        mock_db = MagicMock()
        ok = processar_partida({}, db_client=mock_db)
        assert ok is False
        mock_db.table.assert_not_called()
