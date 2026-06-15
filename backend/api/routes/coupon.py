"""
coupon.py — Rotas de cupons (prefixo: /api/v1/coupons)
"""

import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from backend.core.auth import get_user_from_token
from backend.services.coupon_service import list_public_coupons, redeem_coupon


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


class RedeemRequest(BaseModel):
    code: str
    supabase_token: str


# Mapeia o status da RPC para (HTTP status, mensagem).
_REDEEM_ERRORS = {
    "not_found":        (404, "Cupom inválido."),
    "expired":          (400, "Cupom expirado ou inativo."),
    "already_redeemed": (409, "Você já resgatou este cupom."),
    "exhausted":        (409, "Cupom esgotado."),
    "invalid_code":     (422, "Informe um código de cupom."),
}


@router.post("/redeem")
def redeem(req: RedeemRequest):
    """Resgata um cupom para o usuário logado e concede o benefício (tokens)."""
    tier, user_id = get_user_from_token(req.supabase_token)

    code = (req.code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=422, detail="Informe um código de cupom.")

    try:
        db = _get_supabase()
        result = redeem_coupon(db, user_id, code)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:  # noqa: BLE001
        logger.error(f"Erro ao resgatar cupom: {err}")
        raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")

    status = result.get("status")
    if status == "ok":
        return {
            "status": "ok",
            "granted": result.get("tokens_granted", 0),
            "expires_at": result.get("expires_at"),
        }

    http_status, detail = _REDEEM_ERRORS.get(status, (500, "Não foi possível resgatar. Tente novamente."))
    raise HTTPException(status_code=http_status, detail=detail)
