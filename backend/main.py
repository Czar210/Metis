import logging
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from scripts.ingestion.fetch_matches import fetch_player_matches, get_r2_client

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Metis API",
    description="Interface de Ingestão de Dados para a IA Metis",
    version="0.1.0"
)

from backend.api.routes import player, stats, match, admin, champion, item
app.include_router(player.router)
app.include_router(stats.router)
app.include_router(match.router)
app.include_router(admin.router)
app.include_router(champion.router)
app.include_router(item.router)

# ── CORS ──────────────────────────────────────────────────────────────
# Origens permitidas: variável de ambiente ou padrões de desenvolvimento.
# Em produção, defina CORS_ORIGINS="https://metis.vercel.app" (ou o domínio real).
_default_origins = [
    "http://localhost:3000",       # Next.js dev server
    "http://localhost:3001",       # fallback dev port
]
_env_origins = os.getenv("CORS_ORIGINS", "")
allowed_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _default_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# O "Contrato" de entrada
class MatchRequest(BaseModel):
    nick: str
    tag: str
    server: str
    count: int

class ChatRequest(BaseModel):
    mensagem: str

@app.post("/api/v1/ingestion/fetch-matches")
async def ingest_matches(req: MatchRequest):
    """
    Endpoint para buscar partidas ranqueadas.
    Pula as que já existem no R2 e devolve o status da operação.
    """
    s3 = get_r2_client()
    if not s3:
        logger.warning("S3/R2 client não configurado — partidas não serão salvas no bucket.")

    resultado = fetch_player_matches(
        game_name=req.nick,
        tag_line=req.tag,
        server=req.server,
        count=req.count,
        s3_client=s3
    )

    if resultado.get("status") == "error":
        raise HTTPException(status_code=400, detail=resultado.get("error"))

    return resultado

@app.post("/api/v1/chat")
def chat(req: ChatRequest):
    """
    Chat interativo com a IA Metis.
    Usa Gemini Flash Lite (API) ou Ollama (local) via adapter.
    """
    from backend.services.llm_adapter import get_llm
    try:
        llm = get_llm()
        resposta = llm.generate(req.mensagem)
        return {"resposta": resposta, "status": "ok"}
    except Exception as err:
        logger.error(f"[chat] Erro: {err}")
        return {
            "resposta": "Desculpe, não consegui processar sua mensagem. Tente novamente.",
            "status": "error",
        }

@app.get("/api/v1/health")
def health_check():
    return {"status": "online", "system": "Metis"}
