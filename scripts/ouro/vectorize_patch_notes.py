"""
vectorize_patch_notes.py - Pipeline de vetorizacao de patch notes

Le arquivos de patch notes do R2, gera embeddings via Gemini e salva
na tabela patch_notes do Supabase (pgvector).

Uso:
    python -m scripts.ouro.vectorize_patch_notes
"""

import gzip
import json
import logging
import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client

from scripts.utils.r2_storage import get_r2_client

load_dotenv()

BUCKET_NAME    = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
PATCH_PREFIX   = "patch_notes/"
EMBED_MODEL    = "gemini-embedding-001"
SLEEP_BETWEEN  = 0.7


def list_patch_files(s3_client) -> list[str]:
    paginator = s3_client.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=PATCH_PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".json.gz"):
                keys.append(key)
    return keys


def download_patch(s3_client, key: str) -> list[dict] | None:
    try:
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
        compressed = response["Body"].read()
        return json.loads(gzip.decompress(compressed).decode("utf-8"))
    except Exception as e:
        logging.warning("Falha ao baixar %s: %s", key, e)
        return None


def get_processed_patches(db_client) -> set[str]:
    result = db_client.table("patch_notes").select("patch_version").execute()
    return {row["patch_version"] for row in result.data if row.get("patch_version")}


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


def build_embed_input(record: dict) -> str:
    """
    Constroi o texto de embedding com contexto rico para melhor recuperacao.

    Exemplos:
      "Patch 16.7. Campeao Akali: nerf - Q damage: 55 -> 50"
      "Patch 16.7. Item Eclipse: buff - Omnivamp: 6% -> 8%"
    """
    type_label = {
        "champion": "Campeao",
        "item":     "Item",
        "rune":     "Runa",
        "system":   "Sistema",
    }.get(record["entity_type"], record["entity_type"].capitalize())

    return (
        f"Patch {record['patch_version']}. "
        f"{type_label} {record['entity_name']}: "
        f"{record['change_type']} - {record['content']}"
    )


def vectorize_patch(records: list[dict], patch_version: str, gemini_client, db_client) -> int:
    inserted = 0
    for record in records:
        embed_input = build_embed_input(record)
        embedding = embed_text(gemini_client, embed_input)
        time.sleep(SLEEP_BETWEEN)

        if embedding is None:
            continue

        db_client.table("patch_notes").upsert(
            {
                "patch_version": record["patch_version"],
                "entity_type":   record["entity_type"],
                "entity_name":   record["entity_name"],
                "change_type":   record["change_type"],
                "description":   record["description"],
                "content":       record["content"],
                "embedding":     embedding,
            },
            on_conflict="patch_version,entity_type,entity_name,change_type",
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
        raise RuntimeError("R2 client nao inicializado.")

    db     = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    gemini = genai.Client(
        api_key=os.environ["GEMINI_KEY"],
        http_options=types.HttpOptions(api_version="v1"),
    )

    all_files      = list_patch_files(s3)
    processed      = get_processed_patches(db)

    # Filtra patches que ainda nao foram vetorizados
    pending = [
        f for f in all_files
        if f.replace(PATCH_PREFIX, "").replace(".json.gz", "") not in processed
    ]

    logging.info(
        "Patches no R2: %d | Ja vetorizados: %d | Pendentes: %d",
        len(all_files), len(processed), len(pending),
    )

    total = 0
    for file_key in pending:
        records = download_patch(s3, file_key)
        if not records:
            continue
        patch_version = file_key.replace(PATCH_PREFIX, "").replace(".json.gz", "")
        n = vectorize_patch(records, patch_version, gemini, db)
        total += n
        logging.info("[%s] %d registros inseridos.", patch_version, n)

    logging.info("Concluido - %d registros no total.", total)


if __name__ == "__main__":
    run()
