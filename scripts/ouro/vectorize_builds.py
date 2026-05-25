"""
vectorize_builds.py - ETL de partidas high-elo: R2 -> agregacao -> Supabase

Le partidas do R2, agrega builds vencedoras por (campeo, role, patch),
gera embeddings via Gemini e upserta na tabela high_elo_builds.

Uso:
    python -m scripts.ouro.vectorize_builds
    python -m scripts.ouro.vectorize_builds --patch 14.5 --min-samples 10
"""

import gzip
import json
import logging
import os
import sys
from collections import Counter, defaultdict

import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client

from scripts.utils.r2_storage import get_r2_client

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BUCKET_NAME   = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
EMBED_MODEL   = "gemini-embedding-001"
BATCH_SIZE    = 10
MIN_SAMPLES   = 15

JUNK_ITEM_IDS = {0, 2003, 2055, 2138, 2139, 2140, 3340, 3363, 3364, 7050}

ROLE_DISPLAY = {
    "TOP": "Top", "JUNGLE": "Jungle", "MIDDLE": "Mid",
    "BOTTOM": "ADC", "UTILITY": "Support", "UNKNOWN": "Unknown",
}


def _fetch_item_names() -> dict[int, str]:
    try:
        ver   = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=10).json()[0]
        data  = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/item.json", timeout=15).json()
        return {int(k): v["name"] for k, v in data["data"].items()}
    except Exception as e:
        logging.warning("Falha ao buscar item names: %s", e)
        return {}


def _list_match_keys(s3_client, max_matches: int | None = None) -> list[str]:
    import random
    paginator = s3_client.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix="matches/"):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    if max_matches and len(keys) > max_matches:
        keys = random.sample(keys, max_matches)
        logging.info("Amostragem aleatoria: %d de %d partidas", max_matches, len(keys) + max_matches)
    return keys


def _load_match(s3_client, key: str) -> dict | None:
    try:
        obj  = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
        data = json.loads(gzip.decompress(obj["Body"].read()))
        info = data.get("info", {})
        if info.get("queueId") not in (420, 440):
            return None
        if info.get("gameDuration", 0) < 900:
            return None
        return data
    except Exception:
        return None


def _normalize_patch(version: str) -> str:
    parts = version.split(".")
    return f"{parts[0]}.{parts[1]}" if len(parts) >= 2 else version


def _extract_final_items(participant: dict) -> list[int]:
    items = [
        participant.get(f"item{i}", 0)
        for i in range(6)
    ]
    return [i for i in items if i and i not in JUNK_ITEM_IDS]


def aggregate_builds(
    s3_client,
    target_patch: str | None = None,
    min_samples: int = MIN_SAMPLES,
    max_matches: int | None = None,
) -> list[dict]:
    item_names = _fetch_item_names()
    logging.info("Item names carregados: %d", len(item_names))

    keys = _list_match_keys(s3_client, max_matches)
    logging.info("Partidas a processar: %d", len(keys))

    # Estrutura: {(champion, role, patch): {"wins": Counter[frozenset], "total": Counter[frozenset]}}
    build_counts: dict[tuple, dict] = defaultdict(lambda: {"wins": Counter(), "total": Counter()})

    loaded = 0
    for key in keys:
        match = _load_match(s3_client, key)
        if not match:
            continue

        patch = _normalize_patch(match["info"].get("gameVersion", ""))
        if target_patch and patch != target_patch:
            continue

        for p in match["info"].get("participants", []):
            champion = p.get("championName", "")
            role     = p.get("teamPosition", "UNKNOWN") or "UNKNOWN"
            if not champion:
                continue

            items = _extract_final_items(p)
            if len(items) < 3:
                continue

            build_key = frozenset(items[:5])
            bucket    = (champion, role, patch)
            build_counts[bucket]["total"][build_key] += 1
            if p.get("win"):
                build_counts[bucket]["wins"][build_key] += 1

        loaded += 1
        if loaded % 1000 == 0:
            logging.info("Partidas processadas: %d / %d", loaded, len(keys))

    logging.info("Partidas validas processadas: %d", loaded)

    records = []
    for (champion, role, patch), counts in build_counts.items():
        total_games = sum(counts["total"].values())
        if total_games < min_samples:
            continue

        # Top build mais frequente entre vitorias
        if not counts["wins"]:
            continue
        top_build_ids, win_count = counts["wins"].most_common(1)[0]
        total_with_build         = counts["total"][top_build_ids]

        if total_with_build < 5:
            continue

        winrate   = round(win_count / total_with_build * 100, 1)
        item_list = [item_names.get(i, str(i)) for i in sorted(top_build_ids)]

        role_display = ROLE_DISPLAY.get(role, role.title())
        content = (
            f"Build high-elo {champion} {role_display} patch {patch}: "
            f"{', '.join(item_list)}. "
            f"Winrate: {winrate}% em {total_with_build} partidas "
            f"(amostra de {total_games} partidas no total)."
        )

        records.append({
            "champion_name": champion,
            "role":          role,
            "patch_version": patch,
            "items":         item_list,
            "winrate":       winrate,
            "sample_size":   total_with_build,
            "content":       content,
        })

    logging.info("Combinacoes (campeo, role, patch) com amostras suficientes: %d", len(records))
    return records


def _embed_batch(gemini_client, texts: list[str]) -> list[list[float]]:
    result = gemini_client.models.embed_content(
        model=EMBED_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=768,
        ),
    )
    return [e.values for e in result.embeddings]


def vectorize_and_upsert(records: list[dict]) -> None:
    gemini = genai.Client(
        api_key=os.environ["GEMINI_KEY"],
        http_options=types.HttpOptions(api_version="v1"),
    )
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch  = records[i : i + BATCH_SIZE]
        texts  = [r["content"] for r in batch]
        embeds = _embed_batch(gemini, texts)

        rows = []
        for rec, vec in zip(batch, embeds):
            rows.append({
                "champion_name": rec["champion_name"],
                "role":          rec["role"],
                "patch_version": rec["patch_version"],
                "items":         rec["items"],
                "winrate":       rec["winrate"],
                "sample_size":   rec["sample_size"],
                "content":       rec["content"],
                "embedding":     vec,
            })

        db.table("high_elo_builds").upsert(
            rows,
            on_conflict="champion_name,role,patch_version",
        ).execute()
        total += len(rows)
        logging.info("Upsertados %d / %d registros", total, len(records))

    logging.info("Concluido: %d builds vetorizadas.", total)


def run(target_patch: str | None = None, min_samples: int = MIN_SAMPLES, max_matches: int | None = None) -> None:
    s3 = get_r2_client()
    if not s3:
        raise RuntimeError("R2 client nao inicializado.")

    records = aggregate_builds(s3, target_patch=target_patch, min_samples=min_samples, max_matches=max_matches)

    if not records:
        logging.warning("Nenhum registro com amostras suficientes. Ajuste --min-samples.")
        return

    vectorize_and_upsert(records)


if __name__ == "__main__":
    patch_arg   = None
    min_samples = MIN_SAMPLES
    max_matches = None
    if "--patch" in sys.argv:
        idx       = sys.argv.index("--patch")
        patch_arg = sys.argv[idx + 1]
    if "--min-samples" in sys.argv:
        idx         = sys.argv.index("--min-samples")
        min_samples = int(sys.argv[idx + 1])
    if "--max-matches" in sys.argv:
        idx         = sys.argv.index("--max-matches")
        max_matches = int(sys.argv[idx + 1])
    run(patch_arg, min_samples, max_matches)
