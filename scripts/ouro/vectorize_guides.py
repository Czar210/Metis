import gzip
import json
import logging
import os
import re
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client

from scripts.utils.r2_storage import get_r2_client

import requests

load_dotenv()

BUCKET_NAME   = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
GUIDES_PREFIX = "guides/"
EMBED_MODEL   = "gemini-embedding-001"
SLEEP_BETWEEN = 0.7
MAX_CHUNK_CHARS = 1200
MIN_CHUNK_CHARS = 40


def get_current_patch() -> str:
    try:
        versions = requests.get(
            "https://ddragon.leagueoflegends.com/api/versions.json", timeout=10
        ).json()
        raw = versions[0]  # ex: "16.7.1"
        parts = raw.split(".")
        return f"{parts[0]}.{parts[1]}"  # ex: "16.7"
    except Exception as e:
        logging.warning("Falha ao buscar patch atual: %s", e)
        return ""


def chunk_text(text: str) -> list[str]:
    """
    Chunking inteligente em três camadas:
    1. Agrupa linhas (\n simples) de forma gulosa até MAX_CHUNK_CHARS
    2. Linhas individualmente grandes são divididas por sentença
    3. Garante chunks entre MIN_CHUNK_CHARS e MAX_CHUNK_CHARS
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    chunks = []
    current = ""

    for line in lines:
        if len(line) > MAX_CHUNK_CHARS:
            # Linha gigante: salva o current e divide por sentença
            if len(current) >= MIN_CHUNK_CHARS:
                chunks.append(current)
                current = ""
            for sentence in re.split(r"(?<=[.!?])\s+", line):
                if len(current) + len(sentence) + 1 <= MAX_CHUNK_CHARS:
                    current = (current + " " + sentence).strip()
                else:
                    if len(current) >= MIN_CHUNK_CHARS:
                        chunks.append(current)
                    current = sentence
        elif len(current) + len(line) + 1 <= MAX_CHUNK_CHARS:
            # Linha cabe no chunk atual
            current = (current + " " + line).strip()
        else:
            # Chunk cheio: salva e começa novo
            if len(current) >= MIN_CHUNK_CHARS:
                chunks.append(current)
            current = line

    if len(current) >= MIN_CHUNK_CHARS:
        chunks.append(current)

    return chunks


def list_guide_files(s3_client) -> list[str]:
    paginator = s3_client.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=GUIDES_PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".json.gz") and "/html/" not in key:
                keys.append(key)
    return keys


def download_guide(s3_client, key: str) -> dict | None:
    try:
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
        compressed = response["Body"].read()
        return json.loads(gzip.decompress(compressed).decode("utf-8"))
    except Exception as e:
        logging.warning("Falha ao baixar %s: %s", key, e)
        return None


def get_processed_files(db_client) -> set[str]:
    result = db_client.table("champion_guides").select("source_file").execute()
    return {row["source_file"] for row in result.data if row.get("source_file")}


def embed_text(gemini_client, text: str) -> list[float] | None:
    try:
        result = gemini_client.models.embed_content(
            model=EMBED_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=768,
            ),
        )
        return result.embeddings[0].values
    except Exception as e:
        logging.warning("Falha ao gerar embedding: %s", e)
        return None


def vectorize_guide(guide: dict, source_file: str, gemini_client, db_client, patch_version: str = "") -> int:
    champion    = guide.get("champion", "Unknown")
    author      = guide.get("author", "Unknown")
    tier_filter = guide.get("tier_filter", "")
    chapters    = guide.get("chapters", [])

    inserted = 0
    for chapter in chapters:
        title   = chapter.get("title", "")
        content = chapter.get("content", "")

        if len(content) < MIN_CHUNK_CHARS:
            continue

        sub_chunks = chunk_text(content)

        for chunk_index, chunk in enumerate(sub_chunks):
            embed_input = f"Campeão: {champion}. {title}: {chunk}"
            embedding = embed_text(gemini_client, embed_input)
            time.sleep(SLEEP_BETWEEN)

            if embedding is None:
                continue

            row = {
                "champion_name": champion,
                "author":        author,
                "tier_filter":   tier_filter,
                "chapter_title": title,
                "chunk_index":   chunk_index,
                "content":       chunk,
                "source_file":   source_file,
                "embedding":     embedding,
            }
            if patch_version:
                row["patch_version"] = patch_version
            db_client.table("champion_guides").upsert(
                row,
                on_conflict="source_file,chapter_title,chunk_index",
            ).execute()
            inserted += 1

    return inserted


def run() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    s3 = get_r2_client()
    if not s3:
        raise RuntimeError("R2 client não inicializado — verifique as credenciais.")

    db     = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    gemini = genai.Client(
        api_key=os.environ["GEMINI_KEY"],
        http_options=types.HttpOptions(api_version="v1"),
    )

    all_files = list_guide_files(s3)
    processed = get_processed_files(db)
    pending   = [f for f in all_files if f not in processed]

    logging.info(
        "Guides no R2: %d | Já vetorizados: %d | Pendentes: %d",
        len(all_files), len(processed), len(pending),
    )

    patch_version = get_current_patch()
    logging.info("Patch atual: %s", patch_version or "desconhecido")

    total = 0
    for file_key in pending:
        guide = download_guide(s3, file_key)
        if not guide:
            continue
        n = vectorize_guide(guide, file_key, gemini, db, patch_version)
        total += n
        logging.info("[%s] %d chunks inseridos.", file_key, n)

    logging.info("Concluído — %d chunks no total.", total)


if __name__ == "__main__":
    run()
