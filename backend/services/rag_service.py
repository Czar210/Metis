import logging
import os
import time
from threading import Lock

from google import genai
from google.genai import types
from supabase import create_client

logger = logging.getLogger(__name__)

EMBED_MODEL = "gemini-embedding-001"

# MIN_SIMILARITY adaptativo: mais tolerante quando filtramos por campeão,
# mais estrito em queries genéricas para evitar ruído
MIN_SIMILARITY_WITH_FILTER = 0.65
MIN_SIMILARITY_GENERIC     = 0.72

TOP_K_BY_TIER = {
    "free":    5,
    "donor":   3,
    "premium": 5,
    "pro":     8,
}

# Cache de embeddings em memória: { query_text: (embedding, timestamp) }
_embed_cache: dict[str, tuple[list[float], float]] = {}
_embed_cache_lock = Lock()
CACHE_TTL = 3600  # 1 hora


def _get_champion_list() -> list[str]:
    """Busca lista de campeões distintos que temos guias. Resultado estático por processo."""
    try:
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        rows = db.table("champion_guides").select("champion_name").execute()
        return list({r["champion_name"] for r in rows.data if r.get("champion_name")})
    except Exception as e:
        logger.warning("[rag] Falha ao carregar lista de campeões: %s", e)
        return []


_champion_list: list[str] = []
_champion_list_loaded = False


def _get_cached_champion_list() -> list[str]:
    global _champion_list, _champion_list_loaded
    if not _champion_list_loaded:
        _champion_list = _get_champion_list()
        _champion_list_loaded = True
        logger.info("[rag] Lista de campeões carregada: %d campeões", len(_champion_list))
    return _champion_list


def detect_champion(query: str) -> str | None:
    """Retorna o nome do campeão mencionado na query, ou None."""
    q_lower = query.lower()
    for champion in _get_cached_champion_list():
        if champion.lower() in q_lower:
            return champion
    return None


def _get_embedding(gemini_client, query: str) -> list[float] | None:
    """Gera embedding com cache em memória por TTL de 1h."""
    now = time.time()
    with _embed_cache_lock:
        if query in _embed_cache:
            vec, ts = _embed_cache[query]
            if now - ts < CACHE_TTL:
                logger.info("[rag] cache hit para query: %.40s...", query)
                return vec
            del _embed_cache[query]

    try:
        result = gemini_client.models.embed_content(
            model=EMBED_MODEL,
            contents=query,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=768,
            ),
        )
        vec = result.embeddings[0].values
        with _embed_cache_lock:
            _embed_cache[query] = (vec, now)
        return vec
    except Exception as e:
        logger.warning("[rag] Falha ao gerar embedding: %s", e)
        return None


def get_rag_context(query: str, tier: str = "free") -> str:
    """
    Converte a query em embedding, detecta campeão, busca chunks relevantes
    e retorna bloco de contexto formatado. Retorna string vazia se nenhum
    chunk passar o limiar de similaridade.
    """
    top_k = TOP_K_BY_TIER.get(tier, 5)
    champion = detect_champion(query)
    min_similarity = MIN_SIMILARITY_WITH_FILTER if champion else MIN_SIMILARITY_GENERIC

    try:
        gemini = genai.Client(
            api_key=os.environ["GEMINI_KEY"],
            http_options=types.HttpOptions(api_version="v1"),
        )
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

        vec = _get_embedding(gemini, query)
        if vec is None:
            return ""

        rpc_params: dict = {"query_embedding": vec, "match_count": top_k}
        if champion:
            rpc_params["champion_filter"] = champion

        rows = db.rpc("match_champion_guides", rpc_params).execute()

        if not rows.data:
            logger.info("[rag] 0 chunks retornados pela RPC (campeão=%s)", champion)
            return ""

        relevant = [r for r in rows.data if (r.get("similarity") or 0) >= min_similarity]
        if not relevant:
            logger.info(
                "[rag] 0 chunks encontrados (limiar %.2f não atingido, campeão=%s)",
                min_similarity, champion,
            )
            return ""

        logger.info(
            "[rag] %d chunks encontrados (top sim=%.3f, campeão=%s, tier=%s, top_k=%d)",
            len(relevant), relevant[0].get("similarity", 0), champion, tier, top_k,
        )
        parts = [
            f"[{r['champion_name']} — {r['chapter_title']}]\n{r['content']}"
            for r in relevant
        ]
        return "\n\n---\n\n".join(parts)

    except Exception as e:
        logger.warning("[rag] Falha ao buscar contexto: %s", e)
        return ""
