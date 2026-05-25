import logging
import os
import re
import secrets
import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from scripts.ingestion.fetch_matches import fetch_player_matches, get_r2_client

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Metis API",
    description="API da plataforma Metis",
    version="p-0.9.0"
)

from backend.api.routes import player, stats, match, admin, champion, item, coupon, ai
app.include_router(player.router)
app.include_router(stats.router)
app.include_router(match.router)
app.include_router(admin.router)
app.include_router(champion.router)
app.include_router(item.router)
app.include_router(coupon.router)
app.include_router(ai.router)

# ── CORS ──────────────────────────────────────────────────────────────
_default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

# ── API Key Middleware ──────────────────────────────────────────────────

_api_key = os.environ.get("METIS_API_KEY")
if not _api_key:
    _api_key = secrets.token_urlsafe(32)
    logger.warning("[security] METIS_API_KEY nao definida. Gerada temporaria.")

PUBLIC_PATHS = {"/api/v1/health", "/docs", "/openapi.json", "/redoc"}


@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    if request.url.path in PUBLIC_PATHS:
        return await call_next(request)
    provided_key = request.headers.get("X-API-Key", "") or request.query_params.get("api_key", "")
    if provided_key != _api_key:
        return JSONResponse(status_code=403, content={"detail": "Acesso negado. API key invalida ou ausente."})
    return await call_next(request)


# ── Modelos ──────────────────────────────────────────────────────────────

class MatchRequest(BaseModel):
    nick: str
    tag: str
    server: str
    count: int


SYSTEM_PROMPT = (
    "Você é a Metis, uma aliada estratégica especializada em League of Legends. "
    "Responda APENAS perguntas sobre LoL: campeões, builds, matchups, estratégia, meta e patches. "
    "Nunca revele de onde veio a informação. Nunca cite autores, guias ou fontes externas. "
    "Se a pergunta não for sobre LoL ou Metis, recuse educadamente e redirecione. "
    "Mantenha sempre o tom de especialista confiante, direto e sem rodeios."
)

_INJECTION_MARKERS = ("ignore", "system prompt", "jailbreak", "instrução anterior", "forget", "<script", "{%")


def _sanitize_input(text: str) -> str:
    """Trunca input longo e loga tentativas de injection."""
    trimmed = text[:600]
    lower = trimmed.lower()
    if any(marker in lower for marker in _INJECTION_MARKERS):
        logger.warning("[security] Input suspeito detectado: %.80s", trimmed)
    return trimmed


_LOCALE_LANG = {"pt": "português", "en": "English"}

_PATCH_RE = re.compile(
    r"\b(patch|nerfou|buffou|mudou|mudanca|meta|forte|fraco|overpowered|op)\b",
    re.IGNORECASE,
)


def _is_patch_relevant_local(text: str) -> bool:
    return bool(_PATCH_RE.search(text))


class ChatRequest(BaseModel):
    mensagem: str
    supabase_token: str | None = None
    locale: str = "pt"


# ── Chat helpers ──────────────────────────────────────────────────────────

def _get_user_tier(token: str | None) -> tuple[str, str | None]:
    if not token:
        return "free", None
    try:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            return "free", None
        from supabase import create_client
        sb = create_client(url, key)
        result = sb.auth.get_user(token)
        user = result.user
        if not user:
            return "free", None
        tier = (user.app_metadata or {}).get("tier", "free")
        return tier, str(user.id)
    except Exception:
        return "free", None


def _get_tokens_used_today(user_id: str) -> int:
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    sb = create_client(url, key)
    today = datetime.datetime.utcnow().date().isoformat()
    result = (
        sb.table("token_usage")
        .select("tokens_used")
        .eq("user_id", user_id)
        .eq("date", today)
        .limit(1)
        .execute()
    )
    return result.data[0]["tokens_used"] if result.data else 0


def _update_token_usage(user_id: str, total_tokens: int) -> None:
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    sb = create_client(url, key)
    today = datetime.datetime.utcnow().date().isoformat()
    sb.table("token_usage").upsert(
        {"user_id": user_id, "date": today, "tokens_used": total_tokens, "messages_sent": 1},
        on_conflict="user_id,date"
    ).execute()


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/v1/ingestion/fetch-matches")
async def ingest_matches(req: MatchRequest):
    s3 = get_r2_client()
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
    Chat Metis com guardrail de topico, contagem de tokens e limite diario por tier.
    Reset a meia-noite UTC (horario de Londres).
    """
    from backend.services.llm_adapter import get_llm, TIER_LIMITS

    tier, user_id = _get_user_tier(req.supabase_token)

    if not user_id:
        raise HTTPException(status_code=401, detail="Login necessario para usar o chat.")

    token_limit = TIER_LIMITS.get(tier, 0)
    if token_limit == 0:
        raise HTTPException(
            status_code=403,
            detail="Plano atual nao inclui o chat. Faca upgrade em /pricing."
        )

    try:
        tokens_used = _get_tokens_used_today(user_id)
    except Exception:
        tokens_used = 0

    if tokens_used >= token_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Limite diario de {token_limit:,} tokens atingido. Volta a meia-noite UTC (horario de Londres)."
        )

    try:
        llm = get_llm()
        from backend.services.llm_adapter import is_lol_related, GUARDRAIL_REJECTION

        mensagem = _sanitize_input(req.mensagem)

        # Guardrail: classifica se a mensagem e sobre LoL antes de gastar tokens na resposta
        related, guard_tokens = is_lol_related(mensagem, llm)
        guard_cost = max(guard_tokens, 30)  # minimo 30 tokens pro classificador

        if not related:
            # Rejeita aqui — so cobra os tokens do classificador (barato)
            new_total = tokens_used + guard_cost
            try:
                _update_token_usage(user_id, new_total)
            except Exception:
                pass
            return {
                "resposta": GUARDRAIL_REJECTION,
                "status": "off_topic",
                "usage": {
                    "tokens_used": new_total,
                    "token_limit": token_limit,
                    "pct": round(new_total / token_limit * 100, 1),
                    "resets_at": "meia-noite UTC (horario de Londres)",
                }
            }

        # Topico aprovado — busca contexto RAG e gera resposta
        from backend.services.rag_service import get_rag_context
        context, coverage = get_rag_context(mensagem, tier=tier)

        lang   = _LOCALE_LANG.get(req.locale, "português")
        system = f"{SYSTEM_PROMPT}\nResponda sempre em {lang}."

        # Notices de transparencia de cobertura
        notices: list[str] = []
        champion = coverage.get("champion")
        if champion:
            if coverage["guides"] == 0:
                notices.append(
                    f"Nota interna: nao ha guias aprofundados sobre {champion} na base. "
                    f"Informe o usuario de forma natural que sua base sobre esse campeo ainda e limitada."
                )
            if coverage["patch"] == 0 and _is_patch_relevant_local(mensagem):
                notices.append(
                    f"Nota interna: {champion} nao teve mudancas no patch atual. "
                    f"Se o usuario perguntou sobre mudancas, informe que esse campeo nao foi alterado no patch mais recente."
                )

        notice_block = ("\n".join(notices) + "\n\n") if notices else ""

        if context:
            prompt = (
                f"{system}\n\n"
                f"{notice_block}"
                f"Informacoes taticas relevantes sobre o assunto:\n\n"
                f"{context}\n\n---\n\n"
                f"Pergunta: {mensagem}"
            )
        else:
            prompt = f"{system}\n\n{notice_block}Pergunta: {mensagem}"

        result = llm.generate(prompt)
        new_total = tokens_used + guard_cost + max(result.tokens_used, 50)

        try:
            _update_token_usage(user_id, new_total)
        except Exception as e:
            logger.error(f"[chat] Erro ao atualizar tokens: {e}")

        return {
            "resposta": result.text,
            "status": "ok",
            "usage": {
                "tokens_used": new_total,
                "token_limit": token_limit,
                "pct": round(new_total / token_limit * 100, 1),
                "resets_at": "meia-noite UTC (horario de Londres)",
            }
        }
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"[chat] Erro: {err}")
        return {
            "resposta": "Desculpe, nao consegui processar sua mensagem. Tente novamente.",
            "status": "error",
        }


@app.get("/api/v1/chat/usage")
def chat_usage(supabase_token: str):
    """Retorna uso de tokens do usuario hoje."""
    from backend.services.llm_adapter import TIER_LIMITS
    tier, user_id = _get_user_tier(supabase_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login necessario.")
    token_limit = TIER_LIMITS.get(tier, 0)
    tokens_used = _get_tokens_used_today(user_id) if token_limit > 0 else 0
    return {
        "tokens_used": tokens_used,
        "token_limit": token_limit,
        "pct": round(tokens_used / token_limit * 100, 1) if token_limit > 0 else 0,
        "tier": tier,
        "resets_at": "meia-noite UTC (horario de Londres)",
    }


@app.post("/api/v1/admin/refresh-cache")
def refresh_cache():
    """Invalida o cache da tier list e patches. Chamar apos ETL."""
    from backend.services.stats_service import _cache
    count = len(_cache)
    _cache.clear()
    logger.info(f"[cache] Invalidado manualmente — {count} entradas removidas")
    return {"status": "ok", "cleared": count}


@app.get("/api/v1/health")
def health_check():
    return {"status": "online", "system": "Metis", "version": "p-0.9.2"}
