"""
test_item_classification.py — Testes da Fase 1: classificação de itens,
Wilson score e filtro de starters em buscar_builds / buscar_item_ranking.

Todos os testes são unitários (sem banco real).
"""
import math
import pytest
from unittest.mock import MagicMock

from scripts.processing.sync_items import _classify_tier
from scripts.processing.process_matches import extrair_builds_partida
from backend.services.champion_service import _wilson_lower, buscar_builds
from backend.services.item_service import buscar_item_ranking


# ─────────────────────────────────────────────────────────────────────────────
# _classify_tier
# ─────────────────────────────────────────────────────────────────────────────

class TestClassifyTier:
    def _gold(self, total=500, purchasable=True):
        return {"total": total, "purchasable": purchasable, "base": total, "sell": total // 3}

    def test_consumable(self):
        assert _classify_tier(2003, {"tags": ["HealthRegen", "Consumable", "Lane"]}, self._gold(50)) == "CONSUMABLE"

    def test_doran_blade_is_starter(self):
        assert _classify_tier(1055, {"tags": ["Health", "Damage", "Lane"]}, self._gold(450)) == "STARTER"

    def test_doran_ring_is_starter(self):
        assert _classify_tier(1056, {"tags": ["Health", "Lane", "ManaRegen"]}, self._gold(400)) == "STARTER"

    def test_doran_shield_is_starter(self):
        assert _classify_tier(1054, {"tags": ["Health", "HealthRegen", "Lane"]}, self._gold(450)) == "STARTER"

    def test_jungle_starter_no_from(self):
        assert _classify_tier(1101, {"tags": ["Jungle"], "into": None, "from": None}, self._gold(450)) == "STARTER"

    def test_jungle_item_with_from_is_not_starter(self):
        # Itens de jungle evoluídos têm "from"
        assert _classify_tier(1102, {"tags": ["Jungle"], "from": ["1101"]}, self._gold(2200)) != "STARTER"

    def test_support_starter_goldper(self):
        assert _classify_tier(3850, {"tags": ["Health", "GoldPer", "Lane"]}, self._gold(400)) == "STARTER"

    def test_boots_base_is_component(self):
        # Boots of Speed: tem 'into' mas não 'from' → componente intermediário
        assert _classify_tier(1001, {"tags": ["Boots"], "into": ["3006"]}, self._gold(300)) == "COMPONENT"

    def test_advanced_boots_are_boots(self):
        assert _classify_tier(3006, {"tags": ["Boots", "CooldownReduction"], "from": ["1001"]}, self._gold(1000)) == "BOOTS"

    def test_component_has_into(self):
        # Long Sword: sem "from", tem "into"
        assert _classify_tier(1036, {"tags": ["Damage"], "into": ["3134"]}, self._gold(350)) == "COMPONENT"

    def test_full_item_has_from(self):
        # Infinity Edge
        assert _classify_tier(3031, {"tags": ["CriticalStrike", "Damage"], "from": ["1038", "1018"]}, self._gold(3400)) == "FULL"

    def test_full_item_high_gold_no_from(self):
        # Item caro sem "from" explícito deve ser FULL
        assert _classify_tier(9999, {"tags": ["Damage"]}, self._gold(2500)) == "FULL"

    def test_cheap_no_into_no_from_is_component(self):
        # Item barato sem into nem from → COMPONENT (fallback seguro)
        assert _classify_tier(9998, {"tags": []}, self._gold(500)) == "COMPONENT"

    def test_consumable_takes_priority_over_lane(self):
        # Lane + Consumable → CONSUMABLE vence
        assert _classify_tier(2003, {"tags": ["Lane", "Consumable"]}, self._gold(50)) == "CONSUMABLE"

    def test_long_sword_is_component_not_starter(self):
        # Lane + has_into → COMPONENT (não é starter mesmo com tag Lane)
        assert _classify_tier(1036, {"tags": ["Damage", "Lane"], "into": ["3134"]}, self._gold(350)) == "COMPONENT"

    def test_atma_reckoning_is_full_not_starter(self):
        # Lane + gold=2500 → FULL (threshold 800 exclui itens caros com tag Lane)
        assert _classify_tier(223039, {"tags": ["Health", "CriticalStrike", "Lane"]}, self._gold(2500)) == "FULL"

    def test_apex_storm_goldper_is_full_not_starter(self):
        # GoldPer + gold=2800 → FULL (threshold 800 exclui itens completos com tag GoldPer)
        assert _classify_tier(4646, {"tags": ["SpellDamage", "GoldPer"], "from": ["something"]}, self._gold(2800)) == "FULL"

    def test_support_stage2_is_component(self):
        # Lane + gold=950 → não passa no threshold 800 → sem into/from → COMPONENT
        assert _classify_tier(2051, {"tags": ["Health", "HealthRegen", "Lane"]}, self._gold(950)) == "COMPONENT"


# ─────────────────────────────────────────────────────────────────────────────
# _wilson_lower
# ─────────────────────────────────────────────────────────────────────────────

class TestWilsonScore:
    def test_zero_picks_returns_zero(self):
        assert _wilson_lower(0, 0) == 0.0

    def test_perfect_winrate_small_sample_is_penalized(self):
        # 3/3 wins deve ter lower bound bem abaixo de 100% (Wilson é conservador)
        score = _wilson_lower(3, 3)
        assert score < 1.0
        assert score > 0.3

    def test_perfect_winrate_large_sample_approaches_one(self):
        score = _wilson_lower(1000, 1000)
        assert score > 0.98

    def test_50pct_winrate_large_sample(self):
        score = _wilson_lower(1000, 500)
        assert 0.46 < score < 0.50

    def test_more_picks_increases_score_at_same_winrate(self):
        # Mesmo winrate, mais amostras → lower bound maior
        s10 = _wilson_lower(10, 6)
        s100 = _wilson_lower(100, 60)
        assert s100 > s10

    def test_higher_winrate_increases_score(self):
        s_low = _wilson_lower(50, 25)   # 50%
        s_high = _wilson_lower(50, 40)  # 80%
        assert s_high > s_low


# ─────────────────────────────────────────────────────────────────────────────
# extrair_builds_partida — verifica que role é incluído
# ─────────────────────────────────────────────────────────────────────────────

ITEM_DICT = {3031: "Espada do Infinito", 3157: "Ampulheta", 1055: "Lamina de Doran"}

def _make_participant(puuid="p1", champion="Jinx", position="BOTTOM",
                      items=None, win=True, bot=False):
    base = {
        "puuid": puuid, "championName": champion,
        "teamPosition": position, "win": win, "botPlayer": bot,
        "item0": 0, "item1": 0, "item2": 0,
        "item3": 0, "item4": 0, "item5": 0,
    }
    if items:
        base.update(items)
    return base

def _make_match(participants, version="16.4.123"):
    return {
        "metadata": {"matchId": "BR1_TEST"},
        "info": {"gameVersion": version, "participants": participants},
    }


class TestExtrairBuildsRole:
    def test_role_presente_no_registro(self):
        p = _make_participant(items={"item0": 3031})
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds[0]["role"] == "BOTTOM"

    def test_role_unknown_quando_posicao_vazia(self):
        p = _make_participant(items={"item0": 3031})
        p["teamPosition"] = ""
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds[0]["role"] == "UNKNOWN"

    def test_role_unknown_quando_posicao_ausente(self):
        p = _make_participant(items={"item0": 3031})
        del p["teamPosition"]
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds[0]["role"] == "UNKNOWN"

    def test_role_uppercase(self):
        p = _make_participant(items={"item0": 3031}, position="middle")
        builds = extrair_builds_partida(_make_match([p]), ITEM_DICT)
        assert builds[0]["role"] == "MIDDLE"

    def test_todos_os_campos_presentes(self):
        p = _make_participant(items={"item0": 3031})
        build = extrair_builds_partida(_make_match([p]), ITEM_DICT)[0]
        for field in ("champion_name", "item_id", "item_name", "patch", "role", "pick_count", "win_count"):
            assert field in build, f"campo ausente: {field}"


# ─────────────────────────────────────────────────────────────────────────────
# buscar_builds — starters excluídos, ordenação por Wilson score
# ─────────────────────────────────────────────────────────────────────────────

def _mock_db(builds_rows, categories):
    """Monta um db_client fake que retorna dados controlados."""
    db = MagicMock()

    builds_query = MagicMock()
    # Cada método da chain retorna o próprio objeto para suportar fluent API
    builds_query.select.return_value = builds_query
    builds_query.ilike.return_value = builds_query
    builds_query.eq.return_value = builds_query
    builds_query.execute.return_value = MagicMock(data=builds_rows)

    items_query = MagicMock()
    items_query.select.return_value = items_query
    items_query.execute.return_value = MagicMock(
        data=[{"item_id": iid, "category": cat} for iid, cat in categories.items()]
    )

    def table_side_effect(name):
        if name == "champion_builds":
            return builds_query
        if name == "items":
            return items_query
        return MagicMock()

    db.table.side_effect = table_side_effect
    return db


class TestBuscarBuildsFilters:
    _builds = [
        {"item_id": 3031, "item_name": "Espada do Infinito", "patch": "16.4", "role": "BOTTOM", "pick_count": 20, "win_count": 12},
        {"item_id": 1055, "item_name": "Lamina de Doran",    "patch": "16.4", "role": "BOTTOM", "pick_count": 18, "win_count": 10},
        {"item_id": 2003, "item_name": "Pocao de Vida",      "patch": "16.4", "role": "BOTTOM", "pick_count": 15, "win_count": 8},
        {"item_id": 3006, "item_name": "Botas Berserker",    "patch": "16.4", "role": "BOTTOM", "pick_count": 12, "win_count": 7},
        {"item_id": 3094, "item_name": "Espada do Furacão",  "patch": "16.4", "role": "BOTTOM", "pick_count": 10, "win_count": 6},
    ]
    _categories = {
        3031: "FULL",
        1055: "STARTER",
        2003: "CONSUMABLE",
        3006: "BOOTS",
        3094: "FULL",
    }

    def test_starter_excluido(self):
        db = _mock_db(self._builds, self._categories)
        result = buscar_builds(db, "Jinx")
        ids = [r["item_id"] for r in result]
        assert 1055 not in ids, "Doran's Blade (STARTER) não deve aparecer"

    def test_consumable_excluido(self):
        db = _mock_db(self._builds, self._categories)
        result = buscar_builds(db, "Jinx")
        ids = [r["item_id"] for r in result]
        assert 2003 not in ids, "Poção (CONSUMABLE) não deve aparecer"

    def test_full_items_presentes(self):
        db = _mock_db(self._builds, self._categories)
        result = buscar_builds(db, "Jinx")
        ids = [r["item_id"] for r in result]
        assert 3031 in ids
        assert 3094 in ids

    def test_boots_presentes(self):
        db = _mock_db(self._builds, self._categories)
        result = buscar_builds(db, "Jinx")
        ids = [r["item_id"] for r in result]
        assert 3006 in ids

    def test_ordenado_por_wilson_score(self):
        db = _mock_db(self._builds, self._categories)
        result = buscar_builds(db, "Jinx")
        scores = [r["wilson_score"] for r in result]
        assert scores == sorted(scores, reverse=True)

    def test_wilson_score_presente_e_numerico(self):
        db = _mock_db(self._builds, self._categories)
        for item in buscar_builds(db, "Jinx"):
            assert isinstance(item["wilson_score"], float)
            assert 0.0 <= item["wilson_score"] <= 100.0

    def test_min_picks_respeitado(self):
        db = _mock_db(self._builds, self._categories)
        result = buscar_builds(db, "Jinx", min_picks=15)
        assert all(r["pick_count"] >= 15 for r in result)

    def test_categoria_incluida_no_resultado(self):
        db = _mock_db(self._builds, self._categories)
        for item in buscar_builds(db, "Jinx"):
            assert "category" in item
