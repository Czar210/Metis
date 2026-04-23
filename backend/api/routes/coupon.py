"""
coupon.py — Rotas de cupons (prefixo: /api/v1/coupons)
"""

import logging
import os
from fastapi import APIRouter, HTTPException
from supabase import create_client

from backend.services.coupon_service import list_public_coupons


logger = logging.getLogger(__name__)


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(url, key)


router = APIRouter(prefix="/api/v1/coupons", tags=["Coupons"])


@router.get("/public")
def public_coupons():
    """Lista cupons visíveis na pricing page (public_list + active + não expirados)."""
    try:
        db = _get_supabase()
        return list_public_coupons(db)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:  # noqa: BLE001
        logger.error(f"Erro ao listar cupons públicos: {err}")
        raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")
