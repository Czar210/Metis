import logging
import os
import re
import time
from threading import Lock

from google import genai
from google.genai import types
from supabase import create_client

logger = logging.getLogger(__name__)

EMBED_MODEL = "gemini-embedding-001"

MIN_SIMILARITY_WITH_FILTER = 0.65
MIN_SIMILARITY_GENERIC     = 0.72
MIN_SIMILARITY_PATCH       = 0.68

TOP_K_BY_TIER = {
    "free":    5,
    "donor":   3,
    "premium": 5,
    "pro":     8,
}

_embed_cache: dict[str, tuple[list[float], float]] = {}
_embed_cache_lock = Lock()
CACHE_TTL = 3600

_champion_list: list[str] = []
_champion_list_loaded = False

_item_list: list[str] = []
_item_list_loaded = False

# Palavras que indicam interesse em patch/meta/build atual
_PATCH_KEYWORDS = re.compile(
    r"\b(patch|nerfou|buffou|mudou|mudanca|meta|build|item|itemizacao|comprar|forte|fraco|overpowered|op)\b",
    re.IGNORECASE,
)


def _get_champion_list() -> list[str]:
    try:
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        rows = db.table("champion_guides").select("champion_name").execute()
        return list({r["champion_name"] for r in rows.data if r.get("champion_name")})
    except Exception as e:
        logger.warning("[rag] Falha ao carregar lista de campeoes: %s", e)
        return []


def _get_cached_champion_list() -> list[str]:
    global _champion_list, _champion_list_loaded
    if not _champion_list_loaded:
        _champion_list = _get_champion_list()
        _champion_list_loaded = True
        logger.info("[rag] Lista de campeoes carregada: %d campeoes", len(_champion_list))
    return _champion_list


def _get_item_list() -> list[str]:
    try:
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        rows = (
            db.table("patch_notes")
            .select("entity_name")
            .eq("entity_type", "item")
            .execute()
        )
        return list({r["entity_name"] for r in rows.data if r.get("entity_name")})
    except Exception as e:
        logger.warning("[rag] Falha ao carregar lista de itens: %s", e)
        return []


def _get_cached_item_list() -> list[str]:
    global _item_list, _item_list_loaded
    if not _item_list_loaded:
        _item_list = _get_item_list()
        _item_list_loaded = True
        logger.info("[rag] Lista de itens carregada: %d itens", len(_item_list))
    return _item_list


def detect_champion(query: str) -> str | None:
    q_lower = query.lower()
    for champion in _get_cached_champion_list():
        if champion.lower() in q_lower:
            return champion
    return None


def detect_item(query: str) -> str | None:
    q_lower = query.lower()
    for item in _get_cached_item_list():
        if item.lower() in q_lower:
            return item
    return None


def _is_patch_relevant(query: str) -> bool:
    return bool(_PATCH_KEYWORDS.search(query))


def _get_embedding(gemini_client, query: str) -> list[float] | None:
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


def _search_guides(db, vec: list[float], champion: str | None, top_k: int, min_similarity: float) -> list[str]:
    rpc_params: dict = {"query_embedding": vec, "match_count": top_k}
    if champion:
        rpc_params["champion_filter"] = champion

    rows = db.rpc("match_champion_guides", rpc_params).execute()
    if not rows.data:
        return []

    relevant = [r for r in rows.data if (r.get("similarity") or 0) >= min_similarity]
    if not relevant:
        return []

    logger.info(
        "[rag] guias: %d chunks (top sim=%.3f, campeo=%s)",
        len(relevant), relevant[0].get("similarity", 0), champion,
    )
    return [
        f"[{r['champion_name']} - {r['chapter_title']}]\n{r['content']}"
        for r in relevant
    ]


def _search_patch_notes(db, vec: list[float], champion: str | None, item: str | None, top_k: int) -> list[str]:
    entity_filter = champion or item or None
    type_filter   = "item" if item and not champion else None

    rpc_params: dict = {"query_embedding": vec, "match_count": top_k}
    if entity_filter:
        rpc_params["entity_filter"] = entity_filter
    if type_filter:
        rpc_params["type_filter"] = type_filter

    try:
        rows = db.rpc("match_patch_notes", rpc_params).execute()
    except Exception as e:
        logger.warning("[rag] Falha ao buscar patch notes: %s", e)
        return []

    if not rows.data:
        return []

    relevant = [r for r in rows.data if (r.get("similarity") or 0) >= MIN_SIMILARITY_PATCH]
    if not relevant:
        return []

    logger.info(
        "[rag] patch notes: %d registros (top sim=%.3f, entidade=%s)",
        len(relevant), relevant[0].get("similarity", 0), entity_filter,
    )
    return [
        f"[Patch {r['patch_version']} - {r['entity_name']} ({r['change_type']})]\n{r['content']}"
        for r in relevant
    ]


def get_rag_context(query: str, tier: str = "free") -> str:
    top_k      = TOP_K_BY_TIER.get(tier, 5)
    champion   = detect_champion(query)
    item       = detect_item(query)
    patch_rel  = _is_patch_relevant(query)
    min_sim    = MIN_SIMILARITY_WITH_FILTER if champion else MIN_SIMILARITY_GENERIC

    try:
        gemini = genai.Client(
            api_key=os.environ["GEMINI_KEY"],
            http_options=types.HttpOptions(api_version="v1"),
        )
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

        vec = _get_embedding(gemini, query)
        if vec is None:
            return ""

        guide_parts = _search_guides(db, vec, champion, top_k, min_sim)

        patch_parts: list[str] = []
        if patch_rel or item:
            patch_parts = _search_patch_notes(db, vec, champion, item, min(top_k, 5))

        all_parts = guide_parts + patch_parts

        if not all_parts:
            logger.info(
                "[rag] 0 resultados (campeo=%s, item=%s, patch_rel=%s)",
                champion, item, patch_rel,
            )
            return ""

        logger.info(
            "[rag] total: %d partes (guias=%d, patch=%d, tier=%s, top_k=%d)",
            len(all_parts), len(guide_parts), len(patch_parts), tier, top_k,
        )
        return "\n\n---\n\n".join(all_parts)

    except Exception as e:
        logger.warning("[rag] Falha ao buscar contexto: %s", e)
        return ""
