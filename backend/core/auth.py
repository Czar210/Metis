"""
auth.py — Resolucao de usuario a partir do JWT do Supabase.

Helper compartilhado pelos endpoints que precisam identificar o usuario logado
(tier + user_id). Espelha o padrao usado em main._get_user_tier / ai._get_user,
sem acoplar a esses modulos.
"""

from __future__ import annotations

import logging
import os

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def get_user_from_token(token: str | None) -> tuple[str, str]:
    """Retorna (tier, user_id) a partir do access_token do Supabase.

    Levanta HTTPException 401 se o token estiver ausente ou invalido.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Login necessario.")
    try:
        from supabase import create_client

        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL e SUPABASE_KEY ausentes")
        sb = create_client(url, key)
        result = sb.auth.get_user(token)
        user = result.user
        if not user:
            raise HTTPException(status_code=401, detail="Token invalido.")
        tier = (user.app_metadata or {}).get("tier", "free")
        return tier, str(user.id)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[auth] get_user_from_token falhou: {exc}")
        raise HTTPException(status_code=401, detail="Falha na autenticacao.")
