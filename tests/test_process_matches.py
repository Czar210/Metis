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

def make_participant(puuid: str, position: str = "MIDDLE", bot: bool = False,
                     team_id: int = 100, items: list | None = None,
                     keystone: int = 8214, primary_style: int = 8100,
                     secondary_style: int = 8300,
                     total_minions: int = 150, neutral_minions: int = 30,
                     champ_level: int = 18, items_purchased: int = 15) -> dict:
    items = items or [3157, 3165, 3089, 3020, 4645, 3135, 3364]
    return {
        "puuid": puuid,
        "riotIdGameName": f"Player_{puuid[:4]}",
        "riotIdTagline": "BR1",
        "championName": "Ahri",
        "teamPosition": position,
        "teamId": team_id,
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
        "summoner1Id": 4,
        "summoner2Id": 14,
        "totalMinionsKilled": total_minions,
        "neutralMinionsKilled": neutral_minions,
        "champLevel": champ_level,
        "itemsPurchased": items_purchased,
        **{f"item{i}": items[i] if i < len(items) else 0 for i in range(7)},
        "perks": {
            "styles": [
                {
                    "style": primary_style,
                    "selections": [{"perk": keystone, "var1": 0, "var2": 0, "var3": 0}],
                },
                {
                    "style": secondary_style,
                    "selections": [],
                },
            ]
        },
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


# ─────────────────────────────────────────────────────────────────────────────
# Campos enriquecidos v0.6.4 — items, runas, CS/m, team_id
# ─────────────────────────────────────────────────────────────────────────────

class TestCamposEnriquecidos:
    """Garante que extrair_dados_partida() salva os 12 novos campos em cada participante."""

    def _get_first_participant(self, match_json=None) -> dict:
        match_json = match_json or make_match()
        _, _, parts = extrair_dados_partida(match_json)
        return parts[0]

    # ── Items ─────────────────────────────────────────────────────────────────

    def test_items_extraidos_como_lista(self):
        p = self._get_first_participant()
        assert "items" in p
        assert isinstance(p["items"], list)
        assert len(p["items"]) == 7

    def test_items_valores_corretos(self):
        items = [3157, 3165, 3089, 3020, 4645, 3135, 3364]
        match_json = make_match()
        match_json["info"]["participants"][0].update(
            {f"item{i}": items[i] for i in range(7)}
        )
        p = self._get_first_participant(match_json)
        assert p["items"] == items

    def test_items_slot_vazio_vira_zero(self):
        match_json = make_match()
        for i in range(7):
            match_json["info"]["participants"][0][f"item{i}"] = 0
        p = self._get_first_participant(match_json)
        assert all(v == 0 for v in p["items"])
        assert isinstance(p["items"][0], int)

    def test_items_ausentes_viram_zero(self):
        """Se item0..item6 não existirem no JSON, deve retornar lista de zeros."""
        match_json = make_match()
        for i in range(7):
            match_json["info"]["participants"][0].pop(f"item{i}", None)
        p = self._get_first_participant(match_json)
        assert p["items"] == [0, 0, 0, 0, 0, 0, 0]

    # ── Runas ─────────────────────────────────────────────────────────────────

    def test_rune_keystone_extraido(self):
        match_json = make_match()
        match_json["info"]["participants"][0]["perks"] = {
            "styles": [
                {"style": 8100, "selections": [{"perk": 8351}]},
                {"style": 8300, "selections": []},
            ]
        }
        p = self._get_first_participant(match_json)
        assert p["rune_keystone"] == 8351

    def test_rune_primary_extraido(self):
        p = self._get_first_participant()
        assert p["rune_primary"] == 8100

    def test_rune_secondary_extraido(self):
        p = self._get_first_participant()
        assert p["rune_secondary"] == 8300

    def test_rune_keystone_none_sem_perks(self):
        """Participante sem `perks` → keystone = None, sem erro."""
        match_json = make_match()
        match_json["info"]["participants"][0].pop("perks", None)
        p = self._get_first_participant(match_json)
        assert p["rune_keystone"] is None

    def test_rune_keystone_none_sem_selections(self):
        """Estilo primário sem selections → keystone = None."""
        match_json = make_match()
        match_json["info"]["participants"][0]["perks"] = {
            "styles": [{"style": 8100, "selections": []}, {"style": 8300, "selections": []}]
        }
        p = self._get_first_participant(match_json)
        assert p["rune_keystone"] is None

    def test_runes_raw_salvo(self):
        """runes_raw deve conter o dict perks completo."""
        p = self._get_first_participant()
        assert "runes_raw" in p
        assert isinstance(p["runes_raw"], dict)
        assert "styles" in p["runes_raw"]

    # ── CS/m ──────────────────────────────────────────────────────────────────

    def test_total_cs_calculado(self):
        """total_cs = totalMinionsKilled + neutralMinionsKilled."""
        match_json = make_match()
        match_json["info"]["participants"][0]["totalMinionsKilled"] = 150
        match_json["info"]["participants"][0]["neutralMinionsKilled"] = 30
        p = self._get_first_participant(match_json)
        assert p["total_cs"] == 180

    def test_cspm_calculado_corretamente(self):
        """180 CS em 1800s (30 min) = 6.0 CS/m."""
        match_json = make_match(duration=1800)
        match_json["info"]["participants"][0]["totalMinionsKilled"] = 150
        match_json["info"]["participants"][0]["neutralMinionsKilled"] = 30
        p = self._get_first_participant(match_json)
        assert p["cs_per_minute"] == pytest.approx(6.0, rel=0.01)

    def test_cspm_zero_quando_duracao_minima(self):
        """Duração mínima aceita (190s) → cspm calculado sem ZeroDivisionError."""
        match_json = make_match(duration=190)
        match_json["info"]["participants"][0]["totalMinionsKilled"] = 10
        match_json["info"]["participants"][0]["neutralMinionsKilled"] = 0
        _, _, parts = extrair_dados_partida(match_json)
        assert parts[0]["cs_per_minute"] >= 0.0

    def test_total_cs_campo_ausente_vira_zero(self):
        """Se totalMinionsKilled não existir, total_cs deve ser 0."""
        match_json = make_match()
        match_json["info"]["participants"][0].pop("totalMinionsKilled", None)
        match_json["info"]["participants"][0].pop("neutralMinionsKilled", None)
        p = self._get_first_participant(match_json)
        assert p["total_cs"] == 0

    # ── team_id ───────────────────────────────────────────────────────────────

    def test_team_id_100_extraido(self):
        match_json = make_match()
        match_json["info"]["participants"][0]["teamId"] = 100
        p = self._get_first_participant(match_json)
        assert p["team_id"] == 100

    def test_team_id_200_extraido(self):
        match_json = make_match()
        match_json["info"]["participants"][0]["teamId"] = 200
        p = self._get_first_participant(match_json)
        assert p["team_id"] == 200

    # ── Summoner Spells ───────────────────────────────────────────────────────

    def test_summoner1_extraido(self):
        p = self._get_first_participant()
        assert p["summoner1_id"] == 4  # Flash

    def test_summoner2_extraido(self):
        p = self._get_first_participant()
        assert p["summoner2_id"] == 14  # Ignite

    # ── Champion Level ────────────────────────────────────────────────────────

    def test_champion_level_extraido(self):
        p = self._get_first_participant()
        assert p["champion_level"] == 18

    def test_champion_level_default_1_sem_campo(self):
        match_json = make_match()
        match_json["info"]["participants"][0].pop("champLevel", None)
        p = self._get_first_participant(match_json)
        assert p["champion_level"] == 1

    # ── items_purchased ───────────────────────────────────────────────────────

    def test_items_purchased_extraido(self):
        p = self._get_first_participant()
        assert p["items_purchased"] == 15

    def test_items_purchased_default_0_sem_campo(self):
        match_json = make_match()
        match_json["info"]["participants"][0].pop("itemsPurchased", None)
        p = self._get_first_participant(match_json)
        assert p["items_purchased"] == 0
