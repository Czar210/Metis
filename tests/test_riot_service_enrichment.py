"""
test_riot_service_enrichment.py — Testes unitários do riot_service.py (itens v0.6.3/v0.6.4)

Cobre:
  - _processar_e_salvar(): items, runas, CS/m, team_id, summoner spells
  - _processar_e_salvar(): filtros (wrong_queue, remake, short_game)
  - _salvar_timeline(): frames por minuto, mapeamento participantId→PUUID
  - _salvar_timeline(): falha silenciosa (não bloqueia o sync)
"""

import pytest
from unittest.mock import MagicMock

from backend.services.riot_service import (
    _processar_e_salvar,
    _salvar_timeline,
    _normalizar_patch,
)


# ── Factories ─────────────────────────────────────────────────────────────────

def _make_participant(
    puuid="puuid-001",
    champion="Ahri",
    win=True,
    kills=5, deaths=2, assists=8,
    team_id=100,
    team_position="MIDDLE",
    items=None,
    keystone_perk=8214,
    primary_style=8100,
    secondary_style=8300,
    total_minions=150,
    neutral_minions=30,
    champ_level=18,
    items_purchased=15,
    summoner1=4,
    summoner2=14,
):
    items = items or [3157, 3165, 3089, 3020, 4645, 3135, 3364]
    return {
        "puuid": puuid,
        "riotIdGameName": "Teste",
        "riotIdTagline": "BR1",
        "championName": champion,
        "teamPosition": team_position,
        "win": win,
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
        "goldEarned": 12000,
        "totalDamageDealtToChampions": 25000,
        "damageDealtToBuildings": 1000,
        "totalTimeCCDealt": 50,
        "visionScore": 20,
        "champLevel": champ_level,
        "teamId": team_id,
        "summoner1Id": summoner1,
        "summoner2Id": summoner2,
        "totalMinionsKilled": total_minions,
        "neutralMinionsKilled": neutral_minions,
        "itemsPurchased": items_purchased,
        **{f"item{i}": items[i] if i < len(items) else 0 for i in range(7)},
        "perks": {
            "styles": [
                {
                    "style": primary_style,
                    "selections": [{"perk": keystone_perk, "var1": 0, "var2": 0, "var3": 0}],
                },
                {
                    "style": secondary_style,
                    "selections": [],
                },
            ]
        },
        "challenges": {
            "damagePerMinute": 750.0,
            "killParticipation": 0.65,
            "soloKills": 2,
            "earlyLaningPhaseGoldExpAdvantage": 0.3,
        },
    }


def _make_match_data(
    match_id="BR1_999",
    queue_id=420,
    game_duration=1800,
    participants=None,
    version="14.10.555.666",
):
    participants = participants or [_make_participant()]
    return {
        "metadata": {
            "matchId": match_id,
            "participants": [p["puuid"] for p in participants],
        },
        "info": {
            "queueId": queue_id,
            "gameDuration": game_duration,
            "gameVersion": version,
            "gameEndedInEarlySurrender": False,
            "gameEndedInSurrender": False,
            "participants": participants,
        },
    }


def _make_supabase_mock():
    mock = MagicMock()
    mock.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    mock.table.return_value.insert.return_value.execute.return_value = MagicMock()
    return mock


# ── _normalizar_patch ─────────────────────────────────────────────────────────

class TestNormalizarPatch:

    def test_formato_longo(self):
        assert _normalizar_patch("14.10.123.456") == "14.10"

    def test_formato_curto(self):
        assert _normalizar_patch("14.10") == "14.10"

    def test_string_vazia(self):
        result = _normalizar_patch("")
        assert result == "" or result == "unknown"

    def test_none(self):
        result = _normalizar_patch(None)
        assert result == "unknown"


# ── _processar_e_salvar: Filtros ──────────────────────────────────────────────

class TestProcessarFiltros:

    def test_wrong_queue_vai_para_dirty(self):
        """Queue 450 (ARAM) deve ir para matches_dirty."""
        db = _make_supabase_mock()
        data = _make_match_data(queue_id=450)
        result = _processar_e_salvar(db, data)
        assert result["saved"] is False
        assert "wrong_queue" in result["reason"]
        db.table.assert_any_call("matches_dirty")

    def test_soloq_420_aceito(self):
        db = _make_supabase_mock()
        data = _make_match_data(queue_id=420, game_duration=1800)
        result = _processar_e_salvar(db, data)
        assert result["saved"] is True

    def test_flex_440_aceito(self):
        db = _make_supabase_mock()
        data = _make_match_data(queue_id=440, game_duration=1800)
        result = _processar_e_salvar(db, data)
        assert result["saved"] is True

    def test_remake_abaixo_de_300s(self):
        db = _make_supabase_mock()
        data = _make_match_data(queue_id=420, game_duration=200)
        result = _processar_e_salvar(db, data)
        assert result["saved"] is False
        assert result["reason"] == "remake"

    def test_short_game_entre_300_e_900s(self):
        db = _make_supabase_mock()
        data = _make_match_data(queue_id=420, game_duration=500)
        result = _processar_e_salvar(db, data)
        assert result["saved"] is False
        assert result["reason"] == "short_game"

    def test_partida_exatamente_900s_aceita(self):
        """900s é o mínimo aceito (não é short_game)."""
        db = _make_supabase_mock()
        data = _make_match_data(queue_id=420, game_duration=900)
        result = _processar_e_salvar(db, data)
        assert result["saved"] is True

    def test_json_invalido_vai_para_dirty(self):
        db = _make_supabase_mock()
        result = _processar_e_salvar(db, {"metadata": {}, "info": {}})
        assert result["saved"] is False
        assert result["reason"] == "invalid_json"


# ── _processar_e_salvar: Campos Enriquecidos ──────────────────────────────────

class TestProcessarEnriquecimento:

    def _run(self, p=None, game_duration=1800, queue_id=420):
        db = _make_supabase_mock()
        participant = p or _make_participant()
        data = _make_match_data(
            queue_id=queue_id,
            game_duration=game_duration,
            participants=[participant],
        )
        result = _processar_e_salvar(db, data)
        # Captura o payload passado para match_participants.upsert()
        calls = db.table.call_args_list
        mp_call = next((c for c in calls if c[0][0] == "match_participants"), None)
        upsert_payload = None
        if mp_call:
            upsert_mock = db.table.return_value.upsert
            upsert_payload = upsert_mock.call_args_list[-1][0][0]  # lista de dicts
        return result, upsert_payload

    def test_items_extraidos_corretamente(self):
        items = [3157, 3165, 3089, 3020, 4645, 3135, 3364]
        p = _make_participant(items=items)
        result, payload = self._run(p)
        assert result["saved"] is True
        assert payload is not None
        participant_row = payload[0]
        assert participant_row["items"] == items

    def test_items_com_slots_vazios(self):
        """Slots vazios devem ser 0, não None."""
        items = [3157, 0, 0, 0, 0, 0, 0]
        p = _make_participant(items=items)
        _, payload = self._run(p)
        row = payload[0]
        assert row["items"] == items
        assert all(isinstance(v, int) for v in row["items"])

    def test_keystone_extraido(self):
        p = _make_participant(keystone_perk=8351)
        _, payload = self._run(p)
        assert payload[0]["rune_keystone"] == 8351

    def test_rune_primary_e_secondary(self):
        p = _make_participant(primary_style=8100, secondary_style=8300)
        _, payload = self._run(p)
        assert payload[0]["rune_primary"] == 8100
        assert payload[0]["rune_secondary"] == 8300

    def test_total_cs_calculado(self):
        p = _make_participant(total_minions=150, neutral_minions=30)
        _, payload = self._run(p)
        assert payload[0]["total_cs"] == 180

    def test_cspm_calculado(self):
        """180 CS em 1800s (30 min) = 6.0 CS/m."""
        p = _make_participant(total_minions=150, neutral_minions=30)
        _, payload = self._run(p, game_duration=1800)
        assert payload[0]["cs_per_minute"] == pytest.approx(6.0, rel=0.01)

    def test_cspm_zero_quando_duracao_zero(self):
        """game_duration=0 → remake → partida descartada, não salva em match_participants."""
        p = _make_participant(total_minions=100, neutral_minions=20)
        result, payload = self._run(p, game_duration=0)
        # A partida é descartada (remake) antes de calcular o CS/m
        assert result["saved"] is False
        assert result["reason"] == "remake"
        assert payload is None  # nenhum upsert em match_participants

    def test_team_id_extraido(self):
        p = _make_participant(team_id=200)
        _, payload = self._run(p)
        assert payload[0]["team_id"] == 200

    def test_summoner_spells_extraidos(self):
        p = _make_participant(summoner1=4, summoner2=14)
        _, payload = self._run(p)
        assert payload[0]["summoner1_id"] == 4
        assert payload[0]["summoner2_id"] == 14

    def test_champion_level_extraido(self):
        p = _make_participant(champ_level=18)
        _, payload = self._run(p)
        assert payload[0]["champion_level"] == 18

    def test_puuids_retornados_no_resultado(self):
        """_processar_e_salvar deve retornar os PUUIDs dos participantes."""
        p = _make_participant(puuid="puuid-001")
        result, _ = self._run(p)
        assert result["saved"] is True
        assert "puuids" in result
        assert "puuid-001" in result["puuids"]

    def test_patch_normalizado(self):
        db = _make_supabase_mock()
        data = _make_match_data(version="14.10.555.666")
        _processar_e_salvar(db, data)
        # Verifica upsert em matches com game_version normalizado
        matches_upsert = None
        for c in db.table.return_value.upsert.call_args_list:
            arg = c[0][0]
            if isinstance(arg, dict) and "game_version" in arg:
                matches_upsert = arg
                break
        assert matches_upsert is not None
        assert matches_upsert["game_version"] == "14.10"


# ── _salvar_timeline ──────────────────────────────────────────────────────────

class TestSalvarTimeline:

    def _make_timeline(self, puuids, n_frames=3):
        """Cria um objeto de timeline com `n_frames` frames (1 por minuto)."""
        frames = []
        for minute in range(n_frames):
            participant_frames = {}
            for i, puuid in enumerate(puuids):
                pid = str(i + 1)
                participant_frames[pid] = {
                    "minionsKilled": 10 * minute,
                    "jungleMinionsKilled": 2,
                    "totalGold": 500 + 200 * minute,
                    "level": 1 + minute,
                    "xp": 0 + 300 * minute,
                }
            frames.append({
                "timestamp": minute * 60000,
                "participantFrames": participant_frames,
            })
        return {"info": {"frames": frames}}

    def test_salva_frames_no_supabase(self):
        db = _make_supabase_mock()
        lol = MagicMock()
        puuids = ["puuid-001", "puuid-002"]
        lol.match.timeline_by_match.return_value = self._make_timeline(puuids, n_frames=3)

        _salvar_timeline(db, lol, "americas", "BR1_999", puuids)

        db.table.assert_any_call("match_timelines")
        upsert_call = db.table.return_value.upsert.call_args
        saved_data = upsert_call[0][0]
        assert saved_data["match_id"] == "BR1_999"
        assert len(saved_data["frames"]) == 3

    def test_frames_tem_campos_obrigatorios(self):
        db = _make_supabase_mock()
        lol = MagicMock()
        puuids = ["puuid-001"]
        lol.match.timeline_by_match.return_value = self._make_timeline(puuids, n_frames=2)

        _salvar_timeline(db, lol, "americas", "BR1_999", puuids)

        saved_frames = db.table.return_value.upsert.call_args[0][0]["frames"]
        for frame in saved_frames:
            assert "t_ms" in frame
            assert "t_min" in frame
            assert "p" in frame

    def test_mapeamento_participantid_para_puuid(self):
        """O participantId=1 deve ser mapeado para puuids[0]."""
        db = _make_supabase_mock()
        lol = MagicMock()
        puuids = ["puuid-A", "puuid-B"]
        lol.match.timeline_by_match.return_value = self._make_timeline(puuids, n_frames=2)

        _salvar_timeline(db, lol, "americas", "BR1_999", puuids)

        saved_frames = db.table.return_value.upsert.call_args[0][0]["frames"]
        # Minuto 1 (frame index 1): o snapshot deve ter as PUUIDs como chaves
        frame_1 = saved_frames[1]
        assert "puuid-A" in frame_1["p"]
        assert "puuid-B" in frame_1["p"]

    def test_cspm_zerado_no_minuto_0(self):
        """No minuto 0, CS/m não pode ser calculado — deve ser 0.0."""
        db = _make_supabase_mock()
        lol = MagicMock()
        puuids = ["puuid-001"]
        lol.match.timeline_by_match.return_value = self._make_timeline(puuids, n_frames=1)

        _salvar_timeline(db, lol, "americas", "BR1_999", puuids)

        saved_frames = db.table.return_value.upsert.call_args[0][0]["frames"]
        frame_0 = saved_frames[0]
        assert frame_0["p"]["puuid-001"]["cspm"] == 0.0

    def test_falha_silenciosa_em_excecao(self):
        """Se a Riot API falhar, _salvar_timeline não deve lançar exceção."""
        db = _make_supabase_mock()
        lol = MagicMock()
        lol.match.timeline_by_match.side_effect = Exception("Rate limit")

        # Não deve lançar, apenas logar warning
        _salvar_timeline(db, lol, "americas", "BR1_999", ["puuid-001"])

        # Supabase não deve ter sido chamado
        db.table.return_value.upsert.assert_not_called()

    def test_sem_frames_nao_salva(self):
        """Timeline sem frames não deve chamar upsert."""
        db = _make_supabase_mock()
        lol = MagicMock()
        lol.match.timeline_by_match.return_value = {"info": {"frames": []}}

        _salvar_timeline(db, lol, "americas", "BR1_999", ["puuid-001"])

        db.table.return_value.upsert.assert_not_called()

    def test_puuid_out_of_bounds_ignorado(self):
        """participantId maior que len(puuids) deve ser ignorado sem erro."""
        db = _make_supabase_mock()
        lol = MagicMock()
        puuids = ["puuid-001"]  # só 1 PUUID
        # Mas a timeline tem 2 participantes
        tl = {
            "info": {
                "frames": [{
                    "timestamp": 60000,
                    "participantFrames": {
                        "1": {"minionsKilled": 50, "jungleMinionsKilled": 5, "totalGold": 1000, "level": 5, "xp": 1000},
                        "2": {"minionsKilled": 40, "jungleMinionsKilled": 0, "totalGold": 900, "level": 4, "xp": 900},
                    },
                }]
            }
        }
        lol.match.timeline_by_match.return_value = tl

        # Não deve lançar
        _salvar_timeline(db, lol, "americas", "BR1_999", puuids)

        saved = db.table.return_value.upsert.call_args[0][0]
        # Só puuid-001 deve estar no snapshot
        assert "puuid-001" in saved["frames"][0]["p"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
