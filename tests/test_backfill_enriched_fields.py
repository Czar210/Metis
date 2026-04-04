"""
test_backfill_enriched_fields.py — Testes do script de backfill

Cobre:
  - _extrair_campos_enriquecidos(): parsing puro (campos, edge cases, bots)
  - rodar_backfill(): fluxo completo com R2 e Supabase mockados
"""

import pytest
import json
import gzip
import io
from unittest.mock import MagicMock, patch

from scripts.processing.backfill_enriched_fields import (
    _extrair_campos_enriquecidos,
    _buscar_match_ids_pendentes,
    rodar_backfill,
)


# ─────────────────────────────────────────────────────────────────────────────
# Factories
# ─────────────────────────────────────────────────────────────────────────────

def _make_participant(
    puuid="puuid-001",
    team_id=100,
    items=None,
    keystone=8214,
    primary_style=8100,
    secondary_style=8300,
    total_minions=150,
    neutral_minions=30,
    champ_level=18,
    items_purchased=15,
    summoner1=4,
    summoner2=14,
    bot=False,
):
    items = items or [3157, 3165, 3089, 3020, 4645, 3135, 3364]
    return {
        "puuid": puuid,
        "teamId": team_id,
        "botPlayer": bot,
        "summoner1Id": summoner1,
        "summoner2Id": summoner2,
        "totalMinionsKilled": total_minions,
        "neutralMinionsKilled": neutral_minions,
        "champLevel": champ_level,
        "itemsPurchased": items_purchased,
        **{f"item{i}": items[i] if i < len(items) else 0 for i in range(7)},
        "perks": {
            "styles": [
                {"style": primary_style, "selections": [{"perk": keystone}]},
                {"style": secondary_style, "selections": []},
            ]
        },
    }


def _make_match_json(match_id="BR1_001", duration=1800, participants=None):
    participants = participants or [_make_participant(f"puuid-{i:03d}") for i in range(10)]
    return {
        "metadata": {"matchId": match_id, "participants": [p["puuid"] for p in participants]},
        "info": {"gameDuration": duration, "participants": participants},
    }


def _gz(data: dict) -> bytes:
    buf = io.BytesIO()
    with gzip.open(buf, "wt", encoding="utf-8") as f:
        f.write(json.dumps(data))
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# _extrair_campos_enriquecidos — parsing puro
# ─────────────────────────────────────────────────────────────────────────────

class TestExtrairCamposEnriquecidos:

    def test_retorna_lista_de_rows(self):
        rows = _extrair_campos_enriquecidos(_make_match_json())
        assert isinstance(rows, list)
        assert len(rows) == 10

    def test_campos_obrigatorios_presentes(self):
        rows = _extrair_campos_enriquecidos(_make_match_json())
        row = rows[0]
        for campo in [
            "match_id", "puuid", "team_id", "items",
            "summoner1_id", "summoner2_id",
            "rune_keystone", "rune_primary", "rune_secondary", "runes_raw",
            "total_cs", "cs_per_minute", "champion_level", "items_purchased",
        ]:
            assert campo in row, f"Campo ausente: {campo}"

    def test_match_id_correto(self):
        rows = _extrair_campos_enriquecidos(_make_match_json(match_id="BR1_XYZ"))
        assert all(r["match_id"] == "BR1_XYZ" for r in rows)

    def test_items_lista_de_7(self):
        rows = _extrair_campos_enriquecidos(_make_match_json())
        assert all(len(r["items"]) == 7 for r in rows)

    def test_items_valores_corretos(self):
        items = [3157, 3165, 3089, 3020, 4645, 3135, 3364]
        match = _make_match_json(participants=[_make_participant(items=items)])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["items"] == items

    def test_items_slot_vazio_vira_zero(self):
        match = _make_match_json(participants=[_make_participant(items=[0]*7)])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["items"] == [0, 0, 0, 0, 0, 0, 0]

    def test_keystone_extraido(self):
        match = _make_match_json(participants=[_make_participant(keystone=8351)])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["rune_keystone"] == 8351

    def test_rune_primary_e_secondary(self):
        match = _make_match_json(participants=[_make_participant(primary_style=8100, secondary_style=8300)])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["rune_primary"] == 8100
        assert rows[0]["rune_secondary"] == 8300

    def test_keystone_none_sem_perks(self):
        p = _make_participant()
        p.pop("perks", None)
        match = _make_match_json(participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["rune_keystone"] is None

    def test_keystone_none_selections_vazia(self):
        p = _make_participant()
        p["perks"] = {"styles": [{"style": 8100, "selections": []}, {"style": 8300, "selections": []}]}
        match = _make_match_json(participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["rune_keystone"] is None

    def test_total_cs_calculado(self):
        p = _make_participant(total_minions=150, neutral_minions=30)
        match = _make_match_json(participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["total_cs"] == 180

    def test_cspm_calculado(self):
        """180 CS em 1800s = 6.0/m."""
        p = _make_participant(total_minions=150, neutral_minions=30)
        match = _make_match_json(duration=1800, participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["cs_per_minute"] == pytest.approx(6.0, rel=0.01)

    def test_cspm_zero_quando_duration_zero(self):
        p = _make_participant(total_minions=100, neutral_minions=20)
        match = _make_match_json(duration=0, participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["cs_per_minute"] == 0.0

    def test_team_id_extraido(self):
        p = _make_participant(team_id=200)
        match = _make_match_json(participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["team_id"] == 200

    def test_champion_level_extraido(self):
        p = _make_participant(champ_level=16)
        match = _make_match_json(participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["champion_level"] == 16

    def test_champion_level_default_1_sem_campo(self):
        p = _make_participant()
        p.pop("champLevel", None)
        match = _make_match_json(participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert rows[0]["champion_level"] == 1

    def test_bot_ignorado(self):
        participants = [_make_participant("puuid-bot", bot=True), _make_participant("puuid-humano")]
        match = _make_match_json(participants=participants)
        rows = _extrair_campos_enriquecidos(match)
        assert all(r["puuid"] != "puuid-bot" for r in rows)
        assert len(rows) == 1

    def test_bot_prefix_ignorado(self):
        p = _make_participant()
        p["puuid"] = "BOT_abc123"
        match = _make_match_json(participants=[p])
        rows = _extrair_campos_enriquecidos(match)
        assert len(rows) == 0

    def test_json_invalido_retorna_lista_vazia(self):
        assert _extrair_campos_enriquecidos({}) == []
        assert _extrair_campos_enriquecidos({"metadata": {}, "info": {}}) == []

    def test_runes_raw_e_dict(self):
        rows = _extrair_campos_enriquecidos(_make_match_json())
        assert isinstance(rows[0]["runes_raw"], dict)


# ─────────────────────────────────────────────────────────────────────────────
# _buscar_match_ids_pendentes
# ─────────────────────────────────────────────────────────────────────────────

class TestBuscarMatchIdsPendentes:

    def _mock_db(self, rows: list) -> MagicMock:
        db = MagicMock()
        (
            db.table.return_value
            .select.return_value
            .is_.return_value
            .range.return_value
            .execute.return_value
            .data
        ) = rows
        return db

    def test_retorna_lista_de_match_ids(self):
        db = self._mock_db([{"match_id": "BR1_001"}, {"match_id": "BR1_002"}])
        ids = _buscar_match_ids_pendentes(db)
        assert ids == ["BR1_001", "BR1_002"]

    def test_deduplica_match_ids(self):
        rows = [{"match_id": "BR1_001"}, {"match_id": "BR1_001"}, {"match_id": "BR1_002"}]
        db = self._mock_db(rows)
        ids = _buscar_match_ids_pendentes(db)
        assert len(ids) == 2
        assert ids.count("BR1_001") == 1

    def test_lista_vazia_sem_pendentes(self):
        db = self._mock_db([])
        ids = _buscar_match_ids_pendentes(db)
        assert ids == []


# ─────────────────────────────────────────────────────────────────────────────
# rodar_backfill — fluxo completo com mocks
# ─────────────────────────────────────────────────────────────────────────────

class TestRodarBackfill:

    def _make_s3(self, match_data: dict | None):
        s3 = MagicMock()
        if match_data is None:
            from botocore.exceptions import ClientError
            error = ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
            s3.get_object.side_effect = error
            s3.exceptions.NoSuchKey = ClientError
        else:
            s3.get_object.return_value = {"Body": MagicMock(read=lambda: _gz(match_data))}
            s3.exceptions.NoSuchKey = type("NoSuchKey", (Exception,), {})
        return s3

    def _make_db(self, match_ids: list) -> MagicMock:
        db = MagicMock()
        rows = [{"match_id": mid} for mid in match_ids]
        (
            db.table.return_value
            .select.return_value
            .is_.return_value
            .range.return_value
            .execute.return_value
            .data
        ) = rows
        return db

    def test_sem_pendentes_retorna_zero(self):
        db = self._make_db([])
        s3 = MagicMock()
        stats = rodar_backfill(s3_client=s3, db_client=db)
        assert stats["total"] == 0
        assert stats["ok"] == 0

    def test_dry_run_nao_chama_upsert(self):
        match_data = _make_match_json()
        db = self._make_db(["BR1_001"])
        s3 = self._make_s3(match_data)
        rodar_backfill(s3_client=s3, db_client=db, dry_run=True)
        db.table.return_value.upsert.assert_not_called()

    def test_match_sem_r2_contado_em_sem_r2(self):
        db = self._make_db(["BR1_001"])
        s3 = MagicMock()
        s3.get_object.side_effect = Exception("not found")
        s3.exceptions.NoSuchKey = type("NoSuchKey", (Exception,), {})
        stats = rodar_backfill(s3_client=s3, db_client=db)
        assert stats["sem_r2"] == 1

    def test_json_invalido_contado_em_erros(self):
        db = self._make_db(["BR1_001"])
        s3 = self._make_s3({})  # JSON vazio → sem participantes
        stats = rodar_backfill(s3_client=s3, db_client=db)
        assert stats["erros"] == 1

    def test_s3_indisponivel_retorna_zeros(self):
        db = self._make_db(["BR1_001"])
        # get_r2_client é importado localmente dentro de rodar_backfill
        with patch("scripts.utils.r2_storage.get_r2_client", return_value=None):
            stats = rodar_backfill(db_client=db)
        assert stats == {"ok": 0, "sem_r2": 0, "erros": 0, "total": 0}

    def test_total_reflete_pendentes(self):
        match_data = _make_match_json()
        db = self._make_db(["BR1_001", "BR1_002", "BR1_003"])
        s3 = self._make_s3(match_data)
        stats = rodar_backfill(s3_client=s3, db_client=db, dry_run=True)
        assert stats["total"] == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
