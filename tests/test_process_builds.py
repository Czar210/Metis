"""
test_process_builds.py — Testes de extrair_builds_partida()
Cobre: extração de itens, filtros de slot zero, itens fora do dict, bots, win/loss.
"""
import pytest
from scripts.processing.process_matches import extrair_builds_partida

# ── Dicionário de itens de teste ─────────────────────────────────────────────

ITEM_DICT = {
    3078: "Força da Trindade",
    3031: "Espada do Infinito",
    3157: "Ampulheta de Zhonya",
    1001: "Botas",
}

# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_participant(puuid="p001", champion="Ahri", win=True, items=None, bot=False):
    base = {
        "puuid": puuid,
        "championName": champion,
        "win": win,
        "botPlayer": bot,
        "item0": 0, "item1": 0, "item2": 0,
        "item3": 0, "item4": 0, "item5": 0,
    }
    if items:
        base.update(items)
    return base


def _make_match(participants=None, version="14.10.123.456"):
    parts = participants or [_make_participant()]
    return {
        "metadata": {"matchId": "BR1_TEST"},
        "info": {
            "gameVersion": version,
            "participants": parts,
        },
    }


# ── Caminho feliz ─────────────────────────────────────────────────────────────

class TestExtrairBuildsHappyPath:
    def test_item_valido_extraido(self):
        p = _make_participant(items={"item0": 3078})
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert len(builds) == 1
        assert builds[0]["item_id"] == 3078
        assert builds[0]["item_name"] == "Força da Trindade"

    def test_seis_slots_extraidos(self):
        p = _make_participant(items={
            "item0": 3078, "item1": 3031, "item2": 3157,
            "item3": 1001, "item4": 3078, "item5": 3031,
        })
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert len(builds) == 6

    def test_patch_normalizado(self):
        p = _make_participant(items={"item0": 3078})
        builds = extrair_builds_partida(_make_match([p], version="14.10.999.000"), ITEM_DICT)
        assert builds[0]["patch"] == "14.10"

    def test_win_true_conta_win_count_1(self):
        p = _make_participant(win=True, items={"item0": 3078})
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds[0]["win_count"] == 1
        assert builds[0]["pick_count"] == 1

    def test_win_false_conta_win_count_0(self):
        p = _make_participant(win=False, items={"item0": 3078})
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds[0]["win_count"] == 0
        assert builds[0]["pick_count"] == 1

    def test_champion_name_preservado(self):
        p = _make_participant(champion="Jinx", items={"item0": 3031})
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds[0]["champion_name"] == "Jinx"


# ── Filtros ───────────────────────────────────────────────────────────────────

class TestExtrairBuildsFiltros:
    def test_slot_zero_ignorado(self):
        p = _make_participant(items={"item0": 0, "item1": 3078})
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert len(builds) == 1
        assert builds[0]["item_id"] == 3078

    def test_todos_slots_zero_retorna_vazio(self):
        p = _make_participant()  # todos os itens = 0
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds == []

    def test_item_fora_do_dict_ignorado(self):
        """Item real mas sem nome no dict (ward, token de missão, etc.) → ignorado."""
        p = _make_participant(items={"item0": 9999, "item1": 3078})
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert len(builds) == 1
        assert builds[0]["item_id"] == 3078

    def test_bot_ignorado(self):
        p = _make_participant(bot=True, items={"item0": 3078})
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds == []

    def test_puuid_bot_prefix_ignorado(self):
        p = _make_participant(items={"item0": 3078})
        p["puuid"] = "BOT_abc123"
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds == []

    def test_puuid_vazio_ignorado(self):
        p = _make_participant(items={"item0": 3078})
        p["puuid"] = ""
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds == []

    def test_match_json_vazio_retorna_lista_vazia(self):
        builds = extrair_builds_partida({}, ITEM_DICT)
        assert builds == []

    def test_dict_itens_vazio_retorna_lista_vazia(self):
        p = _make_participant(items={"item0": 3078})
        builds = extrair_builds_partida(_make_match([p]), {})
        assert builds == []


# ── Múltiplos participantes ───────────────────────────────────────────────────

class TestExtrairBuildsMultiplos:
    def test_10_participantes_todos_extraidos(self):
        parts = [
            _make_participant(puuid=f"p{i:03d}", items={"item0": 3078})
            for i in range(10)
        ]
        builds = extrair_builds_partida(_make_match(parts), ITEM_DICT)
        assert len(builds) == 10

    def test_mix_win_loss(self):
        vencedores = [_make_participant(puuid=f"v{i}", win=True, items={"item0": 3078}) for i in range(5)]
        perdedores = [_make_participant(puuid=f"l{i}", win=False, items={"item0": 3078}) for i in range(5)]
        builds = extrair_builds_partida(_make_match(vencedores + perdedores), ITEM_DICT)
        assert sum(b["win_count"] for b in builds) == 5
        assert sum(b["pick_count"] for b in builds) == 10
