"""
player.py — Rotas do jogador (prefixo: /api/v1/player)

Endpoints:
  POST /api/v1/player/update-history  →  Atualiza o histórico de partidas de um jogador
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from riotwatcher import ApiError

from backend.services.riot_service import atualizar_historico

router = APIRouter(prefix="/api/v1/player", tags=["Player"])


# ── Contratos de Entrada ──────────────────────────────────────

class UpdateHistoryRequest(BaseModel):
    """Corpo da requisição para atualizar o histórico de um jogador."""
    nick: str = Field(..., examples=["Faker"], description="Nome de invocador (Riot ID)")
    tag: str = Field(..., examples=["KR1"], description="Tag do Riot ID")
    server: str = Field(..., examples=["KR"], description="Servidor (BR1, NA1, KR, EUW1...)")
    count: int = Field(
        default=10,
        ge=1,
        le=20,
        description="Quantidade de partidas para buscar (1-20)",
    )


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/update-history")
async def update_history(req: UpdateHistoryRequest):
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
        # Variáveis de ambiente faltando
        raise HTTPException(status_code=500, detail=str(err))

    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Erro interno: {err}")

class SyncRequest(BaseModel):
    """Corpo da requisição para sincronizar o jogador pelo Riot ID unificado."""
    riot_id: str = Field(..., examples=["Zaras#0210", "Monochaco#BR1"], description="Nome completo com tag")
    server: str = Field(default="BR1", examples=["BR1", "EUW1", "NA1"], description="Servidor")
    count: int = Field(default=10, ge=1, le=20, description="Quantidade de partidas")

@router.post("/sync")
async def sync_player(req: SyncRequest):
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
        raise HTTPException(status_code=500, detail=f"Erro interno: {err}")
