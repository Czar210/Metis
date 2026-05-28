"""
static.py — Dados estáticos do DDragon servidos pelo backend.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta

import requests
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/static", tags=["Static"])
logger = logging.getLogger(__name__)

# Stat shards não estão no runesReforged.json — paths estáveis entre patches
_STAT_SHARD_PATHS: dict[str, str] = {
    "5008": "perk-images/StatMods/StatModsAdaptiveForceIcon.png",
    "5005": "perk-images/StatMods/StatModsAttackSpeedIcon.png",
    "5007": "perk-images/StatMods/StatModsCDRScalingIcon.png",
    "5001": "perk-images/StatMods/StatModsHealthScalingIcon.png",
    "5002": "perk-images/StatMods/StatModsArmorIcon.png",
    "5003": "perk-images/StatMods/StatModsMagicResIcon.png",
}

_rune_cache: dict[str, str] | None = None
_rune_cache_ts: datetime | None = None
_RUNE_TTL = timedelta(hours=24)


def _get_r2_client():
    import boto3
    account_id = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
    access_key = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    if not all([account_id, access_key, secret_key]):
        return None
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def _get_latest_ddragon_version() -> str:
    try:
        r = requests.get(
            "https://ddragon.leagueoflegends.com/api/versions.json", timeout=5
        )
        return r.json()[0]
    except Exception:
        return "16.10.1"


def _fetch_runes_from_r2(version: str) -> list | None:
    try:
        s3 = _get_r2_client()
        if not s3:
            return None
        bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
        obj = s3.get_object(Bucket=bucket, Key=f"static/{version}/runesReforged.json")
        return json.loads(obj["Body"].read())
    except Exception as e:
        logger.warning("[static/runes] R2 miss para versão %s: %s", version, e)
        return None


def _fetch_runes_from_ddragon(version: str) -> list | None:
    try:
        r = requests.get(
            f"https://ddragon.leagueoflegends.com/cdn/{version}/data/pt_BR/runesReforged.json",
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error("[static/runes] DDragon miss: %s", e)
        return None


def _build_rune_map(runes_data: list) -> dict[str, str]:
    """Transforma runesReforged.json em {runeId: iconPath} — formato pronto para URL."""
    rune_map: dict[str, str] = {}
    for tree in runes_data:
        for slot in tree.get("slots", []):
            for rune in slot.get("runes", []):
                rune_id = rune.get("id")
                icon = rune.get("icon", "")
                if rune_id and icon:
                    rune_map[str(rune_id)] = icon
    rune_map.update(_STAT_SHARD_PATHS)
    return rune_map


@router.get("/runes")
def get_rune_map() -> dict[str, str]:
    """Mapa {runeId: iconPath} derivado do DDragon atual. Cache in-process de 24h."""
    global _rune_cache, _rune_cache_ts

    now = datetime.utcnow()
    if _rune_cache and _rune_cache_ts and (now - _rune_cache_ts) < _RUNE_TTL:
        return _rune_cache

    version = _get_latest_ddragon_version()
    runes_data = _fetch_runes_from_r2(version) or _fetch_runes_from_ddragon(version)

    if not runes_data:
        raise HTTPException(status_code=503, detail="Dados de runas indisponíveis temporariamente.")

    _rune_cache = _build_rune_map(runes_data)
    _rune_cache_ts = now
    logger.info("[static/runes] Cache atualizado — versão %s, %d runas", version, len(_rune_cache))
    return _rune_cache
