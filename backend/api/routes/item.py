"""
item.py — Rotas de estatísticas de itens (prefixo: /api/v1/items)
"""

import os
from fastapi import APIRouter, HTTPException, Query
from supabase import create_client

from backend.services.item_service import buscar_item_ranking


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(url, key)


router = APIRouter(prefix="/api/v1/items", tags=["Items"])


@router.get("/ranking")
def item_ranking(
    patch: str | None = Query(default=None, description="Filtro de patch"),
    role: str | None = Query(default=None, description="Filtro de role"),
    min_picks: int = Query(default=5, ge=1, description="Mínimo de vezes que o item foi comprado"),
):
    """Ranking de itens por popularidade com winrate."""
    try:
        db = _get_supabase()
        return buscar_item_ranking(db, patch=patch, role=role, min_picks=min_picks)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Erro interno: {err}")
