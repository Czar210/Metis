"""
Testes para stats_cache.py e a integracao com stats_service / item_service.
"""

import gzip
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_champion_stats(patch: str = "16.10") -> dict:
    return {
        "patch": patch,
        "generated_at": "2026-05-26T16:00:00+00:00",
        "total_unique_matches": 1000,
        "ban_counts": {"Yasuo": 200, "Ahri": 50},
        "champions": [
            {
                "champion": "Ahri",
                "role": "MIDDLE",
                "total_matches": 100,
                "wins": 55,
                "role_share": 95.0,
                "avg_kills": 6.5,
                "avg_deaths": 4.0,
                "avg_assists": 7.0,
                "avg_gold": 12000.0,
                "avg_damage_per_minute": 800.0,
                "avg_kill_participation": 0.65,
            },
            {
                "champion": "Yasuo",
                "role": "MIDDLE",
                "total_matches": 80,
                "wins": 38,
                "role_share": 70.0,
                "avg_kills": 7.0,
                "avg_deaths": 5.0,
                "avg_assists": 5.0,
                "avg_gold": 11500.0,
                "avg_damage_per_minute": 750.0,
                "avg_kill_participation": 0.55,
            },
        ],
    }


def _make_item_stats(patch: str = "16.10") -> dict:
    return {
        "patch": patch,
        "generated_at": "2026-05-26T16:00:00+00:00",
        "by_role": {
            "ALL": [
                {"item_id": 3157, "picks": 500, "wins": 265},
                {"item_id": 3089, "picks": 300, "wins": 150},
            ],
            "MIDDLE": [
                {"item_id": 3157, "picks": 200, "wins": 110},
            ],
        },
    }


def _gz(data: dict) -> bytes:
    return gzip.compress(json.dumps(data).encode("utf-8"))


# ── stats_cache ───────────────────────────────────────────────────────────────

class TestStatsCache(unittest.TestCase):

    def setUp(self):
        # Limpa o cache entre testes
        from backend.services import stats_cache
        stats_cache._cache.clear()

    @patch("backend.services.stats_cache._get_r2_client")
    def test_get_champion_stats_cache_miss_r2_ok(self, mock_r2):
        """Cache miss -> lê R2 -> salva em memória -> retorna dados."""
        mock_client = MagicMock()
        mock_client.get_object.return_value = {
            "Body": MagicMock(read=lambda: _gz(_make_champion_stats()))
        }
        mock_r2.return_value = mock_client

        from backend.services.stats_cache import get_champion_stats
        result = get_champion_stats("16.10")

        self.assertIsNotNone(result)
        self.assertEqual(result["patch"], "16.10")
        self.assertEqual(result["total_unique_matches"], 1000)
        self.assertEqual(len(result["champions"]), 2)
        mock_client.get_object.assert_called_once()

    @patch("backend.services.stats_cache._get_r2_client")
    def test_get_champion_stats_cache_hit(self, mock_r2):
        """Segundo acesso usa memória, não chama R2 novamente."""
        mock_client = MagicMock()
        mock_client.get_object.return_value = {
            "Body": MagicMock(read=lambda: _gz(_make_champion_stats()))
        }
        mock_r2.return_value = mock_client

        from backend.services.stats_cache import get_champion_stats
        get_champion_stats("16.10")   # popula cache
        get_champion_stats("16.10")   # deve usar memória

        self.assertEqual(mock_client.get_object.call_count, 1)

    @patch("backend.services.stats_cache._get_r2_client")
    def test_get_champion_stats_r2_ausente_retorna_none(self, mock_r2):
        """R2 lança exceção -> retorna None (não crasha)."""
        mock_client = MagicMock()
        mock_client.get_object.side_effect = Exception("NoSuchKey")
        mock_r2.return_value = mock_client

        from backend.services.stats_cache import get_champion_stats
        result = get_champion_stats("16.10")
        self.assertIsNone(result)

    @patch("backend.services.stats_cache._get_r2_client")
    def test_get_item_stats_cache_miss_r2_ok(self, mock_r2):
        mock_client = MagicMock()
        mock_client.get_object.return_value = {
            "Body": MagicMock(read=lambda: _gz(_make_item_stats()))
        }
        mock_r2.return_value = mock_client

        from backend.services.stats_cache import get_item_stats
        result = get_item_stats("16.10")

        self.assertIsNotNone(result)
        self.assertIn("ALL", result["by_role"])
        self.assertEqual(len(result["by_role"]["ALL"]), 2)

    def test_invalidar_cache(self):
        """invalidar_cache() limpa todas as entradas e retorna a contagem."""
        from backend.services import stats_cache
        stats_cache._cache["champion_stats:16.10"] = (datetime.now(timezone.utc), {})
        stats_cache._cache["item_stats:16.10"] = (datetime.now(timezone.utc), {})

        from backend.services.stats_cache import invalidar_cache
        count = invalidar_cache()

        self.assertEqual(count, 2)
        self.assertEqual(len(stats_cache._cache), 0)


# ── buscar_tierlist com cache ─────────────────────────────────────────────────

class TestTierlistComCache(unittest.TestCase):

    def setUp(self):
        from backend.services import stats_cache
        stats_cache._cache.clear()
        from backend.services import stats_service
        stats_service._cache.clear()

    @patch("backend.services.stats_cache._get_r2_client")
    def test_tierlist_usa_cache_quando_patch_especificado(self, mock_r2):
        """buscar_tierlist(patch=X) deve usar R2 cache e nao chamar Supabase."""
        mock_client = MagicMock()
        mock_client.get_object.return_value = {
            "Body": MagicMock(read=lambda: _gz(_make_champion_stats()))
        }
        mock_r2.return_value = mock_client

        mock_db = MagicMock()

        from backend.services.stats_service import buscar_tierlist
        result = buscar_tierlist(db_client=mock_db, patch="16.10", min_matches=1)

        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        # Supabase nao deve ter sido chamado
        mock_db.table.assert_not_called()

    @patch("backend.services.stats_cache._get_r2_client")
    def test_tierlist_retorna_campos_obrigatorios(self, mock_r2):
        mock_client = MagicMock()
        mock_client.get_object.return_value = {
            "Body": MagicMock(read=lambda: _gz(_make_champion_stats()))
        }
        mock_r2.return_value = mock_client

        from backend.services.stats_service import buscar_tierlist
        result = buscar_tierlist(db_client=MagicMock(), patch="16.10", min_matches=1)

        for entry in result:
            self.assertIn("champion", entry)
            self.assertIn("role", entry)
            self.assertIn("winrate", entry)
            self.assertIn("tier", entry)
            self.assertIn("z_score", entry)
            self.assertIn("pickrate", entry)
            self.assertIn("banrate", entry)

    @patch("backend.services.stats_cache._get_r2_client")
    def test_tierlist_fallback_supabase_quando_cache_vazio(self, mock_r2):
        """Quando R2 nao tem o arquivo, deve chamar Supabase."""
        mock_client = MagicMock()
        mock_client.get_object.side_effect = Exception("NoSuchKey")
        mock_r2.return_value = mock_client

        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.range.return_value.execute.return_value.data = []

        from backend.services.stats_service import buscar_tierlist
        result = buscar_tierlist(db_client=mock_db, patch="16.10", min_matches=1)

        self.assertIsInstance(result, list)
        mock_db.table.assert_called()


# ── buscar_item_ranking com cache ─────────────────────────────────────────────

class TestItemRankingComCache(unittest.TestCase):

    def setUp(self):
        from backend.services import stats_cache
        stats_cache._cache.clear()

    @patch("backend.services.stats_cache._get_r2_client")
    def test_item_ranking_usa_cache(self, mock_r2):
        mock_client = MagicMock()
        mock_client.get_object.return_value = {
            "Body": MagicMock(read=lambda: _gz(_make_item_stats()))
        }
        mock_r2.return_value = mock_client

        mock_db = MagicMock()
        # Catalogo vazio — nao deve causar crash
        mock_db.table.return_value.select.return_value.execute.return_value.data = []

        from backend.services.item_service import buscar_item_ranking
        result = buscar_item_ranking(mock_db, patch="16.10", min_picks=1)

        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["item_id"], 3157)

    @patch("backend.services.stats_cache._get_r2_client")
    def test_item_ranking_role_filter_usa_cache(self, mock_r2):
        mock_client = MagicMock()
        mock_client.get_object.return_value = {
            "Body": MagicMock(read=lambda: _gz(_make_item_stats()))
        }
        mock_r2.return_value = mock_client

        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.execute.return_value.data = []

        from backend.services.item_service import buscar_item_ranking
        result = buscar_item_ranking(mock_db, patch="16.10", role="MIDDLE", min_picks=1)

        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["item_id"], 3157)

    @patch("backend.services.stats_cache._get_r2_client")
    def test_item_ranking_fallback_supabase(self, mock_r2):
        """Sem patch especificado, deve usar Supabase diretamente."""
        mock_client = MagicMock()
        mock_r2.return_value = mock_client

        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.execute.return_value.data = []

        from backend.services.item_service import buscar_item_ranking
        result = buscar_item_ranking(mock_db, patch=None, min_picks=1)

        self.assertIsInstance(result, list)
        mock_db.table.assert_called()


if __name__ == "__main__":
    unittest.main()
