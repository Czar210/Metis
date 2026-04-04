"""
test_champion_api.py — Testes funcionais dos endpoints de campeão.

Cobertura:
  - /overview  : campeão válido, inexistente, filtros, min_matches
  - /builds    : campeão válido, inexistente, filtro patch
  - /matchups  : campeão válido, inexistente, filtro role
  - /synergies : campeão válido, inexistente, filtro role
  - Validação de query params (min_matches < 1 → 422)
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

CHAMPION_EXISTS  = "Ahri"
CHAMPION_MISSING = "XYZCampeaoInexistente123"


# ── /overview ─────────────────────────────────────────────────────────────────

class TestChampionOverview:
    def test_overview_valido_retorna_200(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/overview")
        assert res.status_code == 200
        body = res.json()
        assert body["champion"].lower() == CHAMPION_EXISTS.lower()
        assert "total_matches" in body

    def test_overview_inexistente_retorna_200_stats_null(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_MISSING}/overview")
        assert res.status_code == 200
        body = res.json()
        assert body["total_matches"] == 0
        assert body["stats"] is None

    def test_overview_filtro_role(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/overview?role=MIDDLE")
        assert res.status_code == 200
        body = res.json()
        assert body["filters"]["role"] == "MIDDLE"

    def test_overview_filtro_server(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/overview?server=BR1")
        assert res.status_code == 200

    def test_overview_filtro_patch(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/overview?patch=14.5")
        assert res.status_code == 200

    def test_overview_todos_filtros(self):
        res = client.get(
            f"/api/v1/champion/{CHAMPION_EXISTS}/overview"
            "?role=MIDDLE&server=BR1&patch=14.5&min_matches=1"
        )
        assert res.status_code == 200

    def test_overview_min_matches_invalido(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/overview?min_matches=0")
        assert res.status_code == 422

    def test_overview_min_matches_alto_retorna_stats_null(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/overview?min_matches=999999")
        assert res.status_code == 200
        assert res.json()["stats"] is None

    def test_overview_case_insensitive(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS.lower()}/overview")
        assert res.status_code == 200

    def test_overview_campos_stats(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/overview?min_matches=1")
        body = res.json()
        if body["stats"] is not None:
            expected = {
                "winrate", "avg_kills", "avg_deaths", "avg_assists",
                "avg_gold", "avg_damage_per_minute", "avg_cs_per_minute",
                "avg_kill_participation",
            }
            assert expected.issubset(set(body["stats"].keys()))


# ── /builds ───────────────────────────────────────────────────────────────────

class TestChampionBuilds:
    def test_builds_valido_retorna_200(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/builds")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_builds_inexistente_retorna_lista_vazia(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_MISSING}/builds")
        assert res.status_code == 200
        assert res.json() == []

    def test_builds_filtro_patch(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/builds?patch=14.5")
        assert res.status_code == 200

    def test_builds_min_picks_invalido(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/builds?min_picks=0")
        assert res.status_code == 422

    def test_builds_campos(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/builds?min_picks=1")
        items = res.json()
        if items:
            expected = {"item_id", "item_name", "pick_count", "win_count", "winrate_pct"}
            assert expected.issubset(set(items[0].keys()))


# ── /matchups ─────────────────────────────────────────────────────────────────

class TestChampionMatchups:
    def test_matchups_valido_retorna_200(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/matchups")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_matchups_inexistente_retorna_lista_vazia(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_MISSING}/matchups")
        assert res.status_code == 200
        assert res.json() == []

    def test_matchups_filtro_role(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/matchups?role=MIDDLE")
        assert res.status_code == 200

    def test_matchups_min_matches_invalido(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/matchups?min_matches=0")
        assert res.status_code == 422

    def test_matchups_campos(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/matchups?min_matches=1")
        items = res.json()
        if items:
            assert {"opponent", "games", "winrate"}.issubset(set(items[0].keys()))
            assert items[0]["games"] >= 1
            assert 0.0 <= items[0]["winrate"] <= 100.0

    def test_matchups_ordenado_por_jogos(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/matchups?min_matches=1")
        items = res.json()
        if len(items) > 1:
            games = [i["games"] for i in items]
            assert games == sorted(games, reverse=True)


# ── /synergies ────────────────────────────────────────────────────────────────

class TestChampionSynergies:
    def test_synergies_valido_retorna_200(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/synergies")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_synergies_inexistente_retorna_lista_vazia(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_MISSING}/synergies")
        assert res.status_code == 200
        assert res.json() == []

    def test_synergies_filtro_role(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/synergies?role=MIDDLE")
        assert res.status_code == 200

    def test_synergies_min_matches_invalido(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/synergies?min_matches=0")
        assert res.status_code == 422

    def test_synergies_campos(self):
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/synergies?min_matches=1")
        items = res.json()
        if items:
            assert {"ally", "games", "winrate"}.issubset(set(items[0].keys()))
            assert items[0]["games"] >= 1
            assert 0.0 <= items[0]["winrate"] <= 100.0

    def test_synergies_sem_auto_sinergia(self):
        """O campeão não deve aparecer como aliado de si mesmo."""
        res = client.get(f"/api/v1/champion/{CHAMPION_EXISTS}/synergies?min_matches=1")
        allies = [i["ally"].lower() for i in res.json()]
        assert CHAMPION_EXISTS.lower() not in allies
