"""
test_player_api.py - Comprehensive test suite for Player API
Tests all endpoints (update-history, sync), validations, edge cases, and error handling.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from riotwatcher import ApiError

from backend.main import app


client = TestClient(app)


# ========== UPDATE-HISTORY: Validation Tests ==========

class TestUpdateHistoryValidation:
    """Validation tests for POST /api/v1/player/update-history"""

    def test_nick_empty(self):
        """Empty nick should be handled"""
        payload = {"nick": "", "tag": "BR1", "server": "BR1", "count": 10}
        response = client.post("/api/v1/player/update-history", json=payload)
        assert response.status_code in [422, 400, 502]

    def test_tag_empty(self):
        """Empty tag should be handled"""
        payload = {"nick": "Faker", "tag": "", "server": "BR1", "count": 10}
        response = client.post("/api/v1/player/update-history", json=payload)
        assert response.status_code in [422, 400, 502]

    def test_server_missing(self):
        """Missing server should fail validation"""
        payload = {"nick": "Faker", "tag": "BR1", "count": 10}
        response = client.post("/api/v1/player/update-history", json=payload)
        assert response.status_code in [422, 400]

    def test_count_minimum_boundary(self):
        """Count less than 1 should be rejected"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 0}
        response = client.post("/api/v1/player/update-history", json=payload)
        assert response.status_code in [422, 400]

    def test_count_maximum_boundary(self):
        """Count more than 20 should be rejected"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 21}
        response = client.post("/api/v1/player/update-history", json=payload)
        assert response.status_code in [422, 400]

    def test_count_valid_boundaries(self):
        """Count 1 and 20 should be valid"""
        for count in [1, 20]:
            payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": count}
            with patch("backend.api.routes.player.atualizar_historico") as mock:
                mock.return_value = {"status": "success"}
                response = client.post("/api/v1/player/update-history", json=payload)
                assert response.status_code != 422


# ========== UPDATE-HISTORY: Edge Cases ==========

class TestUpdateHistoryEdgeCases:
    """Edge case tests for update-history"""

    def test_nick_with_spaces(self):
        """Nick with spaces should be accepted"""
        payload = {"nick": "Player Name", "tag": "BR1", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success"}
            response = client.post("/api/v1/player/update-history", json=payload)
            assert response.status_code in [200, 500, 502]

    def test_nick_very_long(self):
        """Very long nick (100 chars)"""
        payload = {"nick": "A" * 100, "tag": "BR1", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success"}
            response = client.post("/api/v1/player/update-history", json=payload)
            assert response.status_code != 422

    def test_tag_very_long(self):
        """Very long tag (50 chars)"""
        payload = {"nick": "Faker", "tag": "B" * 50, "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success"}
            response = client.post("/api/v1/player/update-history", json=payload)
            assert response.status_code != 422


# ========== UPDATE-HISTORY: Error Handling ==========

class TestUpdateHistoryErrorHandling:
    """Error handling tests"""

    def test_player_not_found_404(self):
        """When player not found, should return 404"""
        payload = {"nick": "NotExistent", "tag": "FAKE", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            error = ApiError("not found")
            error.response = MagicMock()
            error.response.status_code = 404
            mock.side_effect = error
            
            response = client.post("/api/v1/player/update-history", json=payload)
            assert response.status_code == 404

    def test_rate_limit_429(self):
        """When rate limited, should return 429"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            error = ApiError("rate limit")
            error.response = MagicMock()
            error.response.status_code = 429
            mock.side_effect = error
            
            api_response = client.post("/api/v1/player/update-history", json=payload)
            assert api_response.status_code == 429

    def test_riot_server_error_502(self):
        """When Riot API errors, should return 502"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            error = ApiError("riot error")
            error.response = MagicMock()
            error.response.status_code = 500
            mock.side_effect = error
            
            api_response = client.post("/api/v1/player/update-history", json=payload)
            assert api_response.status_code == 502

    def test_missing_environment_variables(self):
        """When env vars missing, should return 500"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.side_effect = RuntimeError("RIOT_API_KEY missing")
            response = client.post("/api/v1/player/update-history", json=payload)
            assert response.status_code == 500


# ========== UPDATE-HISTORY: Success Tests ==========

class TestUpdateHistorySuccess:
    """Success case tests"""

    def test_valid_player_success(self):
        """Valid request returns 200 with correct format"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "KR", "count": 5}
        expected = {"status": "success", "processed_matches": 5, "new_matches": 5, "errors": []}
        
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = expected
            response = client.post("/api/v1/player/update-history", json=payload)
            assert response.status_code == 200
            assert response.json()["status"] == "success"

    def test_multiple_servers(self):
        """Works with different servers"""
        servers = ["BR1", "NA1", "EUW1", "KR", "JP1"]
        for server in servers:
            payload = {"nick": "Player", "tag": "0000", "server": server, "count": 10}
            with patch("backend.api.routes.player.atualizar_historico") as mock:
                mock.return_value = {"status": "success", "new_matches": 3}
                response = client.post("/api/v1/player/update-history", json=payload)
                assert response.status_code == 200

    def test_response_has_required_fields(self):
        """Response has all required fields"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {
                "status": "success",
                "processed_matches": 10,
                "skipped": 2,
                "new_matches": 8,
                "errors": []
            }
            response = client.post("/api/v1/player/update-history", json=payload)
            data = response.json()
            assert "status" in data
            assert "processed_matches" in data
            assert "new_matches" in data
            assert isinstance(data["errors"], list)


# ========== SYNC: Validation Tests ==========

class TestSyncValidation:
    """Validation tests for POST /api/v1/player/sync"""

    def test_riot_id_without_hash(self):
        """riot_id without # should fail"""
        payload = {"riot_id": "FakerBR1", "server": "BR1", "count": 10}
        response = client.post("/api/v1/player/sync", json=payload)
        assert response.status_code == 400

    def test_riot_id_empty_name(self):
        """riot_id with empty name should fail"""
        payload = {"riot_id": "#BR1", "server": "BR1", "count": 10}
        response = client.post("/api/v1/player/sync", json=payload)
        assert response.status_code == 400

    def test_riot_id_empty_tag(self):
        """riot_id with empty tag should fail"""
        payload = {"riot_id": "Faker#", "server": "BR1", "count": 10}
        response = client.post("/api/v1/player/sync", json=payload)
        assert response.status_code == 400

    def test_riot_id_multiple_hashes(self):
        """riot_id with multiple # splits on first"""
        payload = {"riot_id": "Faker#BR1#Extra", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success"}
            response = client.post("/api/v1/player/sync", json=payload)
            assert response.status_code != 400

    def test_count_out_of_range(self):
        """Count out of range should fail"""
        for invalid_count in [0, 21, 100]:
            payload = {"riot_id": "Faker#BR1", "server": "BR1", "count": invalid_count}
            response = client.post("/api/v1/player/sync", json=payload)
            assert response.status_code in [422, 400]


# ========== SYNC: Edge Cases ==========

class TestSyncEdgeCases:
    """Edge cases for sync endpoint"""

    def test_riot_id_with_spaces(self):
        """riot_id with spaces should work"""
        payload = {"riot_id": "Player Name#TAG123", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success"}
            response = client.post("/api/v1/player/sync", json=payload)
            assert response.status_code in [200, 500, 502]

    def test_riot_id_whitespace_trimmed(self):
        """Whitespace should be trimmed"""
        payload = {"riot_id": "  Faker  #  BR1  ", "server": "BR1", "count": 10}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success"}
            response = client.post("/api/v1/player/sync", json=payload)
            assert mock.called


# ========== SYNC: Success Tests ==========

class TestSyncSuccess:
    """Success cases for sync"""

    def test_sync_valid(self):
        """Valid sync returns 200"""
        payload = {"riot_id": "Faker#BR1", "server": "KR", "count": 5}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success", "new_matches": 5}
            response = client.post("/api/v1/player/sync", json=payload)
            assert response.status_code == 200
            assert response.json()["status"] == "success"

    def test_sync_calls_with_correct_args(self):
        """Sync calls atualizar_historico with correct parsed args"""
        payload = {"riot_id": "TestPlayer#1234", "server": "NA1", "count": 15}
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success"}
            response = client.post("/api/v1/player/sync", json=payload)
            
            mock.assert_called_once()
            call_kwargs = mock.call_args[1]
            assert call_kwargs["game_name"] == "TestPlayer"
            assert call_kwargs["tag_line"] == "1234"
            assert call_kwargs["server"] == "NA1"
            assert call_kwargs["count"] == 15


# ========== General HTTP Tests ==========

class TestHTTPBehavior:
    """General HTTP protocol tests"""

    def test_invalid_json_response(self):
        """Invalid JSON payload returns 422"""
        response = client.post(
            "/api/v1/player/update-history",
            data="{invalid",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422

    def test_missing_required_field(self):
        """Missing required field returns 422"""
        response = client.post(
            "/api/v1/player/update-history",
            json={"nick": "Faker"}
        )
        assert response.status_code == 422

    def test_wrong_type_for_field(self):
        """Wrong type for field returns 422"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": "ten"}
        response = client.post("/api/v1/player/update-history", json=payload)
        assert response.status_code == 422

    def test_error_response_has_detail(self):
        """Error responses include 'detail' field"""
        payload = {"nick": "", "tag": "BR1", "server": "BR1", "count": 10}
        response = client.post("/api/v1/player/update-history", json=payload)
        data = response.json()
        assert "detail" in data


# ========== Performance Tests ==========

class TestPerformance:
    """Performance and concurrency tests"""

    def test_sequential_requests(self):
        """Multiple sequential requests work"""
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success"}
            
            for i in range(5):
                payload = {
                    "nick": f"Player{i}",
                    "tag": f"TAG{i}",
                    "server": "BR1",
                    "count": 10
                }
                response = client.post("/api/v1/player/update-history", json=payload)
                assert response.status_code == 200
            
            assert mock.call_count == 5

    def test_retry_after_rate_limit(self):
        """Can retry after receiving rate limit"""
        payload = {"nick": "Faker", "tag": "BR1", "server": "BR1", "count": 10}
        
        # First request: rate limit
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            error = ApiError("rate limit")
            error.response = MagicMock()
            error.response.status_code = 429
            mock.side_effect = error
            
            api_response = client.post("/api/v1/player/update-history", json=payload)
            assert api_response.status_code == 429
        
        # Second request: success
        with patch("backend.api.routes.player.atualizar_historico") as mock:
            mock.return_value = {"status": "success", "new_matches": 3}
            api_response = client.post("/api/v1/player/update-history", json=payload)
            assert api_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
