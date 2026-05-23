import logging
import os

from google import genai
from google.genai import types
from supabase import create_client

logger = logging.getLogger(__name__)

EMBED_MODEL    = "gemini-embedding-001"
TOP_K          = 5
MIN_SIMILARITY = 0.70


def get_rag_context(query: str) -> str:
    """
    Converte a query em embedding, busca os chunks mais relevantes no pgvector
    e retorna um bloco de contexto formatado para injetar no prompt.
    Retorna string vazia se nenhum chunk passar o limiar de similaridade.
    """
    try:
        gemini = genai.Client(
            api_key=os.environ["GEMINI_KEY"],
            http_options=types.HttpOptions(api_version="v1"),
        )
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

        result = gemini.models.embed_content(
            model=EMBED_MODEL,
            contents=query,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=768,
            ),
        )
        vec = result.embeddings[0].values

        rows = db.rpc("match_champion_guides", {
            "query_embedding": vec,
            "match_count": TOP_K,
        }).execute()

        if not rows.data:
            return ""

        relevant = [r for r in rows.data if (r.get("similarity") or 0) >= MIN_SIMILARITY]
        if not relevant:
            logger.info("[rag] 0 chunks encontrados (limiar %.2f não atingido)", MIN_SIMILARITY)
            return ""

        logger.info("[rag] %d chunks encontrados (top sim=%.3f)", len(relevant), relevant[0].get("similarity", 0))
        parts = [
            f"[{r['champion_name']} — {r['chapter_title']}]\n{r['content']}"
            for r in relevant
        ]
        return "\n\n---\n\n".join(parts)

    except Exception as e:
        logger.warning("[rag] Falha ao buscar contexto: %s", e)
        return ""
