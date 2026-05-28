"""
stats_cache.py — Cache de stats pre-computados servidos do R2.

Lê arquivos gerados por compute_stats.py:
  stats/{patch}/champion_stats.json.gz
  stats/{patch}/item_stats.json.gz

Mantém cópias em memória com TTL de 24h para evitar round-trips ao R2 a cada request.
Retorna None (silenciosamente) quando o arquivo nao existe no R2 — o caller faz fallback.
"""

from __future__ import annotations

import gzip
import json
import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

_TTL = timedelta(hours=24)
# Chave: "champion_stats:{patch}" ou "item_stats:{patch}" → (timestamp, data)
_cache: dict[str, tuple[datetime, dict]] = {}


def _get_r2_client():
    try:
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
    except Exception:
        return None


def _read_r2_json_gz(key: str) -> dict | None:
    client = _get_r2_client()
    if not client:
        return None
    bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
    try:
        response = client.get_object(Bucket=bucket, Key=key)
        compressed = response["Body"].read()
        return json.loads(gzip.decompress(compressed).decode("utf-8"))
    except Exception as e:
        logger.debug("stats_cache: nao foi possivel ler %s: %s", key, e)
        return None


def _get(cache_key: str, r2_key: str) -> dict | None:
    now = datetime.now(timezone.utc)
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL:
            logger.debug("stats_cache hit: %s", cache_key)
            return data
        del _cache[cache_key]

    logger.info("stats_cache miss: %s — buscando R2", cache_key)
    data = _read_r2_json_gz(r2_key)
    if data is not None:
        _cache[cache_key] = (now, data)
    return data


def get_champion_stats(patch: str) -> dict | None:
    """
    Retorna o dict de champion_stats para o patch especificado.
    Estrutura: {patch, generated_at, total_unique_matches, ban_counts, champions: [...]}
    Retorna None se o arquivo nao existe no R2 (fallback para Supabase).
    """
    return _get(f"champion_stats:{patch}", f"stats/{patch}/champion_stats.json.gz")


def get_item_stats(patch: str) -> dict | None:
    """
    Retorna o dict de item_stats para o patch especificado.
    Estrutura: {patch, generated_at, by_role: {ALL: [...], MIDDLE: [...], ...}}
    Retorna None se o arquivo nao existe no R2 (fallback para Supabase).
    """
    return _get(f"item_stats:{patch}", f"stats/{patch}/item_stats.json.gz")


def invalidar_cache() -> int:
    """Remove todas as entradas do cache. Chamado pelo endpoint /admin/refresh-cache."""
    count = len(_cache)
    _cache.clear()
    logger.info("stats_cache: invalidado — %d entradas removidas", count)
    return count
