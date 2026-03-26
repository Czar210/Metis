import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scripts.ingestion.fetch_matches import fetch_player_matches, get_r2_client

app = FastAPI(
    title="Metis API",
    description="Interface de Ingestão de Dados para a IA Metis",
    version="0.1.0"
)

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

@app.post("/api/v1/ingestion/fetch-matches")
async def ingest_matches(req: MatchRequest):
    """
    Endpoint para buscar partidas ranqueadas.
    Pula as que já existem no R2 e devolve o status da operação.
    """
    s3 = get_r2_client()
    if not s3:
        raise HTTPException(status_code=500, detail="Erro ao conectar com o Storage (R2).")

    # Chama o motor que já deixamos pronto e inteligente
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

@app.get("/health")
def health_check():
    return {"status": "online", "system": "Metis"}
