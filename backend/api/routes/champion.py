"""
champion.py — Rotas de estatísticas por campeão (prefixo: /api/v1/champion)

Endpoints:
  GET /api/v1/champion/{champion}/overview   →  Stats médias do campeão (winrate, KDA, DPM, CS/m, KP)
  GET /api/v1/champion/{champion}/builds     →  Itens mais frequentes com winrate
  GET /api/v1/champion/{champion}/matchups   →  Winrate contra oponentes na mesma lane
  GET /api/v1/champion/{champion}/synergies  →  Winrate junto a cada aliado
"""

import os
from fastapi import APIRouter, HTTPException, Query
from supabase import create_client

from backend.services.champion_service import (
    buscar_overview,
    buscar_builds,
    buscar_matchups,
    buscar_synergies,
)


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(url, key)


router = APIRouter(prefix="/api/v1/champion", tags=["Champion"])


@router.get("/{champion}/overview")
def get_champion_overview(
    champion: str,
    role:        str | None = Query(default=None, description="Filtrar por lane (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)"),
    server:      str | None = Query(default=None, description="Filtrar por servidor (BR1, NA1, KR...)"),
    patch:       str | None = Query(default=None, description="Filtrar por patch (ex: 15.1)"),
    min_matches: int        = Query(default=1, ge=1, description="Mínimo de partidas para retornar stats"),
):
    """
    📊 Overview do Campeão

    Retorna estatísticas médias agregadas: winrate, KDA, DPM, CS/m, KP e gold.
    Se total_matches < min_matches, retorna stats=null (nunca 404).
    """
    try:
        db = _get_supabase()
        return buscar_overview(db, champion, role=role, server=server, patch=patch, min_matches=min_matches)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/{champion}/builds")
def get_champion_builds(
    champion:  str,
    patch:     str | None = Query(default=None, description="Filtrar por patch"),
    min_picks: int        = Query(default=3, ge=1, description="Mínimo de picks para incluir o item"),
):
    """
    🛡 Builds do Campeão

    Retorna os itens mais frequentes com winrate, via view champion_item_stats.
    Ordenado por pick_count desc. Máximo 20 itens.
    """
    try:
        db = _get_supabase()
        return buscar_builds(db, champion, patch=patch, min_picks=min_picks)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/{champion}/matchups")
def get_champion_matchups(
    champion:    str,
    role:        str | None = Query(default=None, description="Lane do campeão (recomendado para matchups)"),
    patch:       str | None = Query(default=None, description="Filtrar por patch"),
    min_matches: int        = Query(default=3, ge=1, description="Mínimo de confrontos para incluir o oponente"),
):
    """
    ⚔ Matchups do Campeão

    Winrate do campeão contra cada oponente na mesma lane.
    Requer filtro ?role= para resultados precisos.
    Ordenado por número de jogos desc.
    """
    try:
        db = _get_supabase()
        return buscar_matchups(db, champion, role=role, patch=patch, min_matches=min_matches)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/{champion}/synergies")
def get_champion_synergies(
    champion:    str,
    role:        str | None = Query(default=None, description="Lane do campeão"),
    patch:       str | None = Query(default=None, description="Filtrar por patch"),
    min_matches: int        = Query(default=3, ge=1, description="Mínimo de partidas juntos para incluir o aliado"),
):
    """
    🤝 Sinergias do Campeão

    Winrate do campeão quando jogando ao lado de cada aliado.
    Ordenado por número de partidas juntos desc.
    """
    try:
        db = _get_supabase()
        return buscar_synergies(db, champion, role=role, patch=patch, min_matches=min_matches)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")
