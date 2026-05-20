"""
ai_cache.py — Cache de respostas da IA via tabela Supabase ai_cache.

TTL controlado por expires_at. Limpeza lazy: cache miss se expires_at < NOW().
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


def _get_supabase():
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY ausentes")
    return create_client(url, key)


def make_hash(data: dict) -> str:
    """SHA-256 do JSON canonicalizado do input."""
    canonical = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode()).hexdigest()


def get_cached(scope: str, id_hash: str) -> dict | None:
    """Retorna o response cacheado ou None se miss/expirado."""
    try:
        db = _get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        result = (
            db.table("ai_cache")
            .select("response, tokens_used, computed_at")
            .eq("scope", scope)
            .eq("id_hash", id_hash)
            .gt("expires_at", now)
            .maybe_single()
            .execute()
        )
        if result.data:
            return result.data
        return None
    except Exception as exc:
        logger.warning(f"[ai_cache] get_cached falhou: {exc}")
        return None


def set_cached(scope: str, id_hash: str, response: dict, tokens_used: int, ttl_days: int) -> None:
    """Grava ou atualiza o cache. Falha silenciosamente para nao bloquear a resposta."""
    try:
        db = _get_supabase()
        now = datetime.now(timezone.utc)
        expires = (now + timedelta(days=ttl_days)).isoformat()
        db.table("ai_cache").upsert(
            {
                "scope": scope,
                "id_hash": id_hash,
                "response": response,
                "tokens_used": tokens_used,
                "computed_at": now.isoformat(),
                "expires_at": expires,
            },
            on_conflict="scope,id_hash",
        ).execute()
    except Exception as exc:
        logger.warning(f"[ai_cache] set_cached falhou: {exc}")
