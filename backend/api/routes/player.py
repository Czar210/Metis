"""
player.py — Rotas do jogador (prefixo: /api/v1/player)

Endpoints:
  POST /api/v1/player/update-history  →  Atualiza o histórico de partidas de um jogador
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from riotwatcher import ApiError

import os
from supabase import create_client

from backend.services.riot_service import atualizar_historico, SyncCooldownError
from backend.services.player_service import buscar_champion_stats_jogador, buscar_frequent_allies, buscar_nemesis, SEASONS
from backend.services.recommendation_service import buscar_recomendacoes


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(url, key)

router = APIRouter(prefix="/api/v1/player", tags=["Player"])


# ── Contratos de Entrada ──────────────────────────────────────

class UpdateHistoryRequest(BaseModel):
    """Corpo da requisição para atualizar o histórico de um jogador."""
    nick: str = Field(..., min_length=1, examples=["Faker"], description="Nome de invocador (Riot ID)")
    tag: str = Field(..., min_length=1, examples=["KR1"], description="Tag do Riot ID")
    server: str = Field(..., examples=["KR"], description="Servidor (BR1, NA1, KR, EUW1...)")
    count: int = Field(
        default=50,
        ge=1,
        le=100,
        description="Quantidade de partidas para buscar (1-100)",
    )


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/update-history")
def update_history(req: UpdateHistoryRequest):
    """
    🔄 Atualizar Histórico de Partidas

    Fluxo completo:
    1. Busca o PUUID do jogador na Riot API
    2. Puxa as últimas N partidas ranqueadas
    3. Filtra remakes e partidas inválidas (Camada Prata)
    4. Salva partidas novas no Supabase (players, matches, match_participants)
    5. Retorna relatório detalhado do que foi processado
    """
    try:
        resultado = atualizar_historico(
            game_name=req.nick,
            tag_line=req.tag,
            server=req.server,
            count=req.count,
        )
        return resultado

    except SyncCooldownError as err:
        raise HTTPException(
            status_code=429,
            detail={"message": "Sincronização em cooldown.", "retry_after_seconds": err.retry_after},
        )

    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    except ApiError as err:
        status = getattr(getattr(err, "response", None), "status_code", None)
        if status == 429:
            raise HTTPException(
                status_code=429,
                detail="Rate limit da Riot API atingido. Tente novamente em alguns segundos.",
            )
        if status == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Jogador '{req.nick}#{req.tag}' não encontrado no servidor {req.server}.",
            )
        raise HTTPException(status_code=502, detail=f"Erro na Riot API: {err}")

    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))

    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")

class SyncRequest(BaseModel):
    """Corpo da requisição para sincronizar o jogador pelo Riot ID unificado."""
    riot_id: str = Field(..., examples=["Zaras#0210", "Monochaco#BR1"], description="Nome completo com tag")
    server: str = Field(default="BR1", examples=["BR1", "EUW1", "NA1"], description="Servidor")
    count: int = Field(default=50, ge=1, le=100, description="Quantidade de partidas")

@router.post("/sync")
def sync_player(req: SyncRequest):
    """
    🔄 Sincronizar Jogador (atalho)
    Faz exatamente a mesma coisa que update-history, mas recebe o riot_id 
    no formato unificado 'Nome#Tag'.
    """
    if "#" not in req.riot_id:
        raise HTTPException(status_code=400, detail="Formato inválido. O riot_id deve ser no formato Nome#Tag.")

    nick, tag = req.riot_id.split("#", 1)

    if not nick.strip() or not tag.strip():
        raise HTTPException(status_code=400, detail="Formato inválido. Nome e Tag não podem ser vazios.")
    
    try:
        resultado = atualizar_historico(
            game_name=nick.strip(),
            tag_line=tag.strip(),
            server=req.server,
            count=req.count,
        )
        return resultado

    except SyncCooldownError as err:
        raise HTTPException(
            status_code=429,
            detail={"message": "Sincronização em cooldown.", "retry_after_seconds": err.retry_after},
        )

    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    except ApiError as err:
        status = getattr(getattr(err, "response", None), "status_code", None)
        if status == 429:
            raise HTTPException(status_code=429, detail="Rate limit atingido. Tente novamente em breve.")
        if status == 404:
            raise HTTPException(status_code=404, detail=f"Jogador '{req.riot_id}' não encontrado em {req.server}.")
        raise HTTPException(status_code=502, detail=f"Erro na Riot API: {err}")

    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))

    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/history")
def player_history(
    puuid: str = Query(..., description="PUUID do jogador"),
    limit: int = Query(default=15, ge=1, le=50, description="Número de partidas (1-50)"),
    offset: int = Query(default=0, ge=0, description="Offset para paginação"),
):
    """
    📜 Histórico de Partidas

    Busca partidas ranqueadas (SoloQ/Flex) de um jogador no Supabase (camada Prata).
    Suporta paginação via offset para o botão "Carregar mais" no frontend.
    Apenas partidas da tabela `matches` (limpas) são retornadas — remakes e filas erradas
    ficam em `matches_dirty` e não aparecem aqui.
    """
    try:
        db = _get_supabase()

        result = (
            db.table("match_participants")
            .select(
                "champion_name, team_position, team_id, win, "
                "kills, deaths, assists, gold_earned, "
                "total_damage_dealt_to_champions, vision_score, "
                "kill_participation, damage_per_minute, "
                "total_cs, cs_per_minute, champion_level, "
                "items, rune_keystone, summoner1_id, summoner2_id, "
                "matches(match_id, game_version, game_duration, queue_id, end_type, game_end_timestamp)"
            )
            .eq("puuid", puuid)
            .order("match_id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        return {
            "puuid": puuid,
            "matches": result.data or [],
            "offset": offset,
            "limit": limit,
            "has_more": len(result.data or []) == limit,
        }

    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/seasons")
def seasons():
    """Retorna as temporadas disponíveis."""
    return list(SEASONS.keys())


@router.get("/search")
def search_players(
    q: str = Query(..., min_length=2, description="Busca por nome (min 2 chars)"),
    server: str | None = Query(default=None, description="Filtro de servidor"),
):
    """Busca jogadores por nome atual ou antigo. Retorna max 8 resultados."""
    try:
        db = _get_supabase()

        # Busca por nome atual
        query = db.table("players").select("puuid, game_name, tag_line, server, profile_icon_id").ilike("game_name", f"%{q}%").limit(8)
        if server:
            query = query.eq("server", server.upper())
        current = query.execute().data or []

        # Se poucos resultados, buscar por nomes antigos tambem
        if len(current) < 8:
            old_query = (
                db.table("player_name_history")
                .select("puuid, old_game_name, old_tag_line, players(game_name, tag_line, server, profile_icon_id)")
                .ilike("old_game_name", f"%{q}%")
                .limit(8 - len(current))
            )
            old_results = old_query.execute().data or []

            # Converter para formato unificado com flag "formerly_known_as"
            seen_puuids = {p["puuid"] for p in current}
            for old in old_results:
                if old["puuid"] in seen_puuids:
                    continue
                pi = old.get("players") or {}
                current.append({
                    "puuid": old["puuid"],
                    "game_name": pi.get("game_name", "???"),
                    "tag_line": pi.get("tag_line", ""),
                    "server": pi.get("server"),
                    "profile_icon_id": pi.get("profile_icon_id"),
                    "formerly": f"{old['old_game_name']}#{old['old_tag_line']}",
                })
                seen_puuids.add(old["puuid"])

        return current
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/name-history")
def name_history(
    puuid: str = Query(..., description="PUUID do jogador"),
):
    """Retorna historico de nomes de um jogador."""
    try:
        db = _get_supabase()
        result = (
            db.table("player_name_history")
            .select("old_game_name, old_tag_line, changed_at")
            .eq("puuid", puuid)
            .order("changed_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/champion-stats")
def champion_stats(
    puuid: str = Query(..., description="PUUID do jogador"),
    queue_id: int | None = Query(default=None, description="Filtro de fila (420=SoloQ, 440=Flex)"),
    role: str | None = Query(default=None, description="Filtro de role (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)"),
    patch: str | None = Query(default=None, description="Filtro de patch (ex: 16.7)"),
    season: str | None = Query(default=None, description="Filtro de temporada (ex: S1-2026)"),
):
    """Stats do jogador por campeão: winrate, KDA, CS/m, jogos. Filtros: fila, role, patch, temporada."""
    try:
        db = _get_supabase()
        return buscar_champion_stats_jogador(db, puuid, queue_id=queue_id, role=role, patch=patch, season=season)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/frequent-allies")
def frequent_allies(
    puuid: str = Query(..., description="PUUID do jogador"),
    min_games: int = Query(default=3, ge=2, description="Mínimo de jogos juntos"),
):
    """Jogadores que apareceram no mesmo time em ≥min_games partidas recentes."""
    try:
        db = _get_supabase()
        return buscar_frequent_allies(db, puuid, min_games=min_games)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/nemesis")
def nemesis(
    puuid: str = Query(..., description="PUUID do jogador"),
    min_games: int = Query(default=2, ge=2, description="Mínimo de vezes enfrentados"),
):
    """Oponentes enfrentados ≥min_games vezes (mesmo match, time oposto)."""
    try:
        db = _get_supabase()
        return buscar_nemesis(db, puuid, min_games=min_games)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


@router.get("/recommendations")
def recommendations(
    puuid: str = Query(..., description="PUUID do jogador"),
    role: str | None = Query(default=None, description="Filtro de role (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)"),
    top_n: int = Query(default=5, ge=1, le=20, description="Numero de recomendacoes"),
    reasons: bool = Query(default=False, description="Incluir explicacoes do match"),
):
    """Recomenda campeoes por LANE baseado no perfil do jogador. Diana JG != Diana Mid."""
    try:
        db = _get_supabase()
        return buscar_recomendacoes(db, puuid, role=role, top_n=top_n, include_reasons=reasons)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")
