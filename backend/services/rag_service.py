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
MIN_SIMILARITY_BUILDS      = 0.60

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

_PATCH_KEYWORDS = re.compile(
    r"\b(patch|nerf(ou|ado|aram)?|buff(ou|ado|aram)?|mudou|mudanca|mudancas|alterou|alterado|"
    r"ajuste|ajustado|meta|build|item|itemizacao|comprar|forte|fraco|overpowered|op)\b",
    re.IGNORECASE,
)

_BUILD_KEYWORDS = re.compile(
    r"\b(build|item|comprar|itemizacao|montar|equipar|rush|primeiro item|segundo item|core|full build)\b",
    re.IGNORECASE,
)


def _get_champion_list() -> list[str]:
    try:
        db      = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        guides  = db.table("champion_guides").select("champion_name").execute()
        builds  = db.table("high_elo_builds").select("champion_name").execute()
        patches = db.table("patch_notes").select("entity_name").eq("entity_type", "champion").execute()
        names: set[str] = set()
        for r in (guides.data  or []):
            if r.get("champion_name"): names.add(r["champion_name"])
        for r in (builds.data  or []):
            if r.get("champion_name"): names.add(r["champion_name"])
        for r in (patches.data or []):
            if r.get("entity_name"):   names.add(r["entity_name"])
        return list(names)
    except Exception as e:
        logger.warning("[rag] Falha ao carregar lista de campeoes: %s", e)
        return []


def _get_cached_champion_list() -> list[str]:
    global _champion_list, _champion_list_loaded
    if not _champion_list_loaded:
        _champion_list        = _get_champion_list()
        _champion_list_loaded = True
        logger.info("[rag] Lista de campeoes carregada: %d campeoes", len(_champion_list))
    return _champion_list


def _get_item_list() -> list[str]:
    try:
        db   = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
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
        _item_list        = _get_item_list()
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


def _is_build_relevant(query: str) -> bool:
    return bool(_BUILD_KEYWORDS.search(query))


def _get_embedding(gemini_client, query: str) -> list[float] | None:
    now = time.time()
    with _embed_cache_lock:
        if query in _embed_cache:
            vec, ts = _embed_cache[query]
            if now - ts < CACHE_TTL:
                logger.info("[rag] cache hit: %.40s...", query)
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


def _expand_query(gemini_client, query: str) -> list[str]:
    """Gera 2 reformulacoes da query para aumentar recall na busca vetorial."""
    try:
        prompt = (
            "Reescreva a seguinte pergunta sobre League of Legends em 2 versoes diferentes, "
            "usando vocabulario alternativo mas mantendo o mesmo significado. "
            "Retorne APENAS as 2 versoes, uma por linha, sem numeracao ou explicacao.\n\n"
            f"Pergunta: {query}"
        )
        result = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=80, temperature=0.3),
        )
        lines      = [l.strip() for l in result.text.strip().split("\n") if l.strip()]
        expansions = lines[:2]
        logger.info("[rag] query expansion: %s", expansions)
        return [query] + expansions
    except Exception as e:
        logger.warning("[rag] Falha no query expansion: %s", e)
        return [query]


def _rerank(gemini_client, query: str, chunks: list[str]) -> list[str]:
    """Re-ordena chunks por relevancia real usando o LLM como cross-encoder."""
    if len(chunks) <= 2:
        return chunks
    try:
        numbered = "\n\n".join(f"[{i+1}] {c[:400]}" for i, c in enumerate(chunks))
        prompt   = (
            f"Pergunta do usuario: {query}\n\n"
            f"Avalie a relevancia de cada trecho abaixo para responder a pergunta. "
            f"Retorne APENAS os numeros em ordem decrescente de relevancia, separados por virgula. "
            f"Exemplo: 3,1,2\n\n{numbered}"
        )
        result    = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=30, temperature=0.0),
        )
        if not result.text:
            return chunks
        order_str = result.text.strip().replace(" ", "")
        order     = [int(x) - 1 for x in order_str.split(",") if x.isdigit()]
        reranked  = [chunks[i] for i in order if 0 <= i < len(chunks)]
        seen      = set(order)
        reranked += [chunks[i] for i in range(len(chunks)) if i not in seen]
        logger.info("[rag] rerank order: %s", order_str)
        return reranked
    except Exception as e:
        logger.warning("[rag] Falha no rerank: %s", e)
        return chunks


def _search_guides(
    db,
    gemini_client,
    query: str,
    champion: str | None,
    top_k: int,
    min_similarity: float,
) -> list[str]:
    queries              = _expand_query(gemini_client, query)
    seen_ids: set        = set()
    all_rows: list[dict] = []

    for q in queries:
        vec = _get_embedding(gemini_client, q)
        if vec is None:
            continue
        params: dict = {"query_embedding": vec, "match_count": max(top_k, 3)}
        if champion:
            params["champion_filter"] = champion
        rows = db.rpc("match_champion_guides", params).execute()
        for r in (rows.data or []):
            uid = f"{r.get('champion_name')}|{r.get('chapter_title')}|{r.get('content', '')[:50]}"
            if uid not in seen_ids and (r.get("similarity") or 0) >= min_similarity:
                seen_ids.add(uid)
                all_rows.append(r)

    if not all_rows:
        return []

    all_rows.sort(key=lambda r: r.get("similarity", 0), reverse=True)
    top_rows = all_rows[:top_k]

    logger.info(
        "[rag] guias: %d chunks (top sim=%.3f, campeo=%s, queries=%d)",
        len(top_rows), top_rows[0].get("similarity", 0), champion, len(queries),
    )

    chunks = [
        f"[{r['champion_name']} - {r['chapter_title']}]\n{r['content']}"
        for r in top_rows
    ]
    return _rerank(gemini_client, query, chunks)


def _search_patch_notes(
    db,
    vec: list[float],
    champion: str | None,
    item: str | None,
    top_k: int,
) -> list[str]:
    entity_filter = champion or item or None
    type_filter   = "item" if item and not champion else None

    params: dict = {"query_embedding": vec, "match_count": top_k}
    if entity_filter:
        params["entity_filter"] = entity_filter
    if type_filter:
        params["type_filter"] = type_filter

    try:
        rows = db.rpc("match_patch_notes", params).execute()
    except Exception as e:
        logger.warning("[rag] Falha ao buscar patch notes: %s", e)
        return []

    relevant = [r for r in (rows.data or []) if (r.get("similarity") or 0) >= MIN_SIMILARITY_PATCH]
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


def _search_builds(
    db,
    vec: list[float],
    champion: str | None,
    top_k: int,
) -> list[str]:
    params: dict = {"query_embedding": vec, "match_count": top_k}
    if champion:
        params["champion_filter"] = champion

    try:
        rows = db.rpc("match_high_elo_builds", params).execute()
    except Exception as e:
        logger.warning("[rag] Falha ao buscar builds: %s", e)
        return []

    relevant = [r for r in (rows.data or []) if (r.get("similarity") or 0) >= MIN_SIMILARITY_BUILDS]
    if not relevant:
        return []

    logger.info(
        "[rag] builds: %d registros (top sim=%.3f, campeo=%s)",
        len(relevant), relevant[0].get("similarity", 0), champion,
    )
    return [r["content"] for r in relevant]


def get_rag_context(query: str, tier: str = "free") -> tuple[str, dict]:
    """
    Retorna (contexto, cobertura).

    cobertura = {
        "guides":             int,
        "patch":              int,
        "builds":             int,
        "champion":           str | None,
        "patch_has_champion": bool,
    }
    """
    top_k     = TOP_K_BY_TIER.get(tier, 5)
    champion  = detect_champion(query)
    item      = detect_item(query)
    patch_rel = _is_patch_relevant(query)
    build_rel = _is_build_relevant(query)
    min_sim   = MIN_SIMILARITY_WITH_FILTER if champion else MIN_SIMILARITY_GENERIC

    coverage = {
        "guides":             0,
        "patch":              0,
        "builds":             0,
        "champion":           champion,
        "patch_has_champion": False,
    }

    try:
        gemini = genai.Client(
            api_key=os.environ["GEMINI_KEY"],
            http_options=types.HttpOptions(api_version="v1"),
        )
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

        vec = _get_embedding(gemini, query)
        if vec is None:
            return "", coverage

        guide_parts = _search_guides(db, gemini, query, champion, top_k, min_sim)
        coverage["guides"] = len(guide_parts)

        patch_parts: list[str] = []
        if patch_rel or item:
            patch_parts = _search_patch_notes(db, vec, champion, item, min(top_k, 5))
        coverage["patch"]              = len(patch_parts)
        coverage["patch_has_champion"] = bool(patch_parts and champion)

        build_parts: list[str] = []
        if build_rel or champion:
            build_parts = _search_builds(db, vec, champion, min(top_k, 3))
        coverage["builds"] = len(build_parts)

        all_parts = guide_parts + patch_parts + build_parts

        if not all_parts:
            logger.info(
                "[rag] 0 resultados (campeo=%s, item=%s, patch_rel=%s, build_rel=%s)",
                champion, item, patch_rel, build_rel,
            )
            return "", coverage

        logger.info(
            "[rag] total: %d partes (guias=%d, patch=%d, builds=%d, tier=%s)",
            len(all_parts), len(guide_parts), len(patch_parts), len(build_parts), tier,
        )
        return "\n\n---\n\n".join(all_parts), coverage

    except Exception as e:
        logger.warning("[rag] Falha ao buscar contexto: %s", e)
        return "", coverage
