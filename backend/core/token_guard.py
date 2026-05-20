"""
token_guard.py — Rate limiting mensal de tokens para endpoints /api/ai/*.

Limites por tier (tokens/mes, reset no primeiro dia de cada mes UTC):
  free:    1_000
  donor:   3_000
  premium: 50_000
  pro:     200_000
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import HTTPException

logger = logging.getLogger(__name__)

MONTHLY_LIMITS: dict[str, int] = {
    "free":    1_000,
    "donor":   3_000,
    "premium": 50_000,
    "pro":     200_000,
}


def _current_year_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _get_supabase():
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY ausentes")
    return create_client(url, key)


def get_monthly_usage(user_id: str) -> int:
    """Retorna tokens usados no mes corrente. Retorna 0 em caso de erro."""
    try:
        db = _get_supabase()
        ym = _current_year_month()
        result = (
            db.table("token_usage_monthly")
            .select("tokens_used")
            .eq("user_id", user_id)
            .eq("year_month", ym)
            .maybe_single()
            .execute()
        )
        return result.data["tokens_used"] if result.data else 0
    except Exception as exc:
        logger.warning(f"[token_guard] get_monthly_usage falhou: {exc}")
        return 0


def check_limit(user_id: str, tier: str) -> int:
    """
    Verifica se o usuario ainda tem quota mensal.
    Retorna tokens ja usados.
    Levanta HTTPException 429 se esgotado.
    Levanta HTTPException 403 se tier nao tem acesso (free ao match-analysis e donator).
    """
    limit = MONTHLY_LIMITS.get(tier, 0)
    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail="Plano atual nao inclui analises de IA. Faca upgrade em /pricing.",
        )
    used = get_monthly_usage(user_id)
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Limite mensal de {limit:,} tokens atingido. "
                "Aguarde o proximo mes ou adquira tokens extras em /pricing."
            ),
        )
    return used


def update_monthly_usage(user_id: str, tokens_used: int) -> None:
    """Adiciona tokens_used ao contador mensal. Falha silenciosamente."""
    try:
        db = _get_supabase()
        ym = _current_year_month()
        now = datetime.now(timezone.utc).isoformat()
        # upsert: se nao existir cria com tokens_used; se existir incrementa
        existing = (
            db.table("token_usage_monthly")
            .select("tokens_used")
            .eq("user_id", user_id)
            .eq("year_month", ym)
            .maybe_single()
            .execute()
        )
        current = existing.data["tokens_used"] if existing.data else 0
        db.table("token_usage_monthly").upsert(
            {
                "user_id": user_id,
                "year_month": ym,
                "tokens_used": current + tokens_used,
                "updated_at": now,
            },
            on_conflict="user_id,year_month",
        ).execute()
    except Exception as exc:
        logger.warning(f"[token_guard] update_monthly_usage falhou: {exc}")


def get_usage_summary(user_id: str, tier: str) -> dict:
    """Retorna dicionario de uso mensal para incluir na resposta."""
    limit = MONTHLY_LIMITS.get(tier, 0)
    used = get_monthly_usage(user_id)
    return {
        "tokens_used": used,
        "token_limit": limit,
        "pct": round(used / limit * 100, 1) if limit > 0 else 0,
        "resets_at": "primeiro dia do proximo mes UTC",
    }
