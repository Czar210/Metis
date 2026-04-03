"""
stats.py — Rotas de estatísticas (prefixo: /api/v1/stats)

Endpoints:
  GET /api/v1/stats/champions  →  Estatísticas agregadas de um campeão
"""

import os
from fastapi import APIRouter, HTTPException, Query
from supabase import create_client

from backend.services.stats_service import buscar_stats_campeao, buscar_tierlist

router = APIRouter(prefix="/api/v1/stats", tags=["Stats"])


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(url, key)


@router.get("/champions")
def champion_stats(
    champion: str = Query(..., description="Nome do campeão (ex: Ahri, Jinx)"),
    role: str | None = Query(default=None, description="Posição (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)"),
    server: str | None = Query(default=None, description="Servidor (BR1, NA1, KR...)"),
    patch: str | None = Query(default=None, description="Patch (ex: 14.10)"),
    elo: str | None = Query(default=None, description="Elo — aceito mas não filtra (sem dados de rank por partida)"),
    min_matches: int = Query(default=1, ge=1, description="Mínimo de partidas para retornar stats (mínimo: 1)"),
):
    """
    📊 Estatísticas Médias de Campeão

    Retorna winrate, KDA médio, ouro médio e DPM para o campeão informado.
    Filtros opcionais: role, server, patch. O filtro elo é aceito mas ignorado
    até que o schema inclua dados de rank por partida.
    """
    try:
        db = _get_supabase()
        return buscar_stats_campeao(
            db_client=db,
            champion=champion,
            role=role,
            server=server,
            patch=patch,
            min_matches=min_matches,
        )
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Erro interno: {err}")


@router.get("/tierlist")
def tierlist(
    role: str | None = Query(default=None, description="Posição (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)"),
    server: str | None = Query(default=None, description="Servidor (BR1, NA1, KR, EUW1...)"),
    patch: str | None = Query(default=None, description="Patch (ex: 15.1)"),
    min_matches: int = Query(default=5, ge=1, description="Mínimo de partidas para incluir campeão"),
):
    """
    🏆 Tier List Global

    Retorna todos os campeões com estatísticas agregadas, ordenados por winrate.
    Filtros opcionais: role, server, patch.
    """
    try:
        db = _get_supabase()
        return buscar_tierlist(
            db_client=db,
            role=role,
            server=server,
            patch=patch,
            min_matches=min_matches,
        )
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Erro interno: {err}")
