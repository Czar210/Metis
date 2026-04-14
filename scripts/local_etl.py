"""
local_etl.py — Script para rodar ETL localmente no PC.

Processa X partidas do R2 (Bronze -> Prata) e envia pro Supabase.
Uso:
    python scripts/local_etl.py --count 50
    python scripts/local_etl.py --count 100 --skip-existing
"""

import argparse
import logging
import os
import sys
import json
import gzip

# Adiciona raiz ao path pra importar scripts.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client
from scripts.processing.process_matches import processar_partida, _get_processed_ids
from scripts.processing.process_timelines import processar_timeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def get_r2_client():
    import boto3
    account_id = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
    access_key = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    if not all([account_id, access_key, secret_key]):
        logger.error("Variaveis R2 nao configuradas no .env")
        return None
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL e SUPABASE_KEY nao configurados no .env")
        return None
    return create_client(url, key)


def list_r2_matches(s3, bucket: str, prefix: str = "matches/") -> list[str]:
    """Lista TODOS os match JSONs no R2 (com paginacao)."""
    try:
        paginator = s3.get_paginator("list_objects_v2")
        keys = []
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                if obj["Key"].endswith(".json.gz"):
                    keys.append(obj["Key"])
        return keys
    except Exception as e:
        logger.error(f"Erro ao listar R2: {e}")
        return []


def download_and_parse(s3, bucket: str, key: str) -> dict | None:
    """Baixa e parseia um match JSON.gz do R2."""
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        raw = gzip.decompress(obj["Body"].read())
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Erro ao baixar {key}: {e}")
        return None


def _get_processed_timeline_ids(db) -> set[str]:
    """IDs de timelines ja processadas (participant_snapshots)."""
    try:
        result = db.table("processed_timelines").select("match_id").execute()
        return {r["match_id"] for r in (result.data or [])}
    except Exception:
        return set()


def main():
    parser = argparse.ArgumentParser(description="ETL local: processa partidas e timelines do R2 -> Supabase")
    parser.add_argument("--count", type=int, default=50, help="Numero de itens a processar (default: 50)")
    parser.add_argument("--skip-existing", action="store_true", help="Pular ja processados")
    parser.add_argument("--bucket", default="metis", help="Nome do bucket R2 (default: metis)")
    parser.add_argument("--only-matches", action="store_true", help="Processar so partidas (sem timelines)")
    parser.add_argument("--only-timelines", action="store_true", help="Processar so timelines (sem partidas)")
    args = parser.parse_args()

    s3 = get_r2_client()
    db = get_supabase()
    if not s3 or not db:
        sys.exit(1)

    # ── Partidas ──────────────────────────────────────────────────
    if not args.only_timelines:
        logger.info(f"=== Partidas: processando ate {args.count} ===")

        all_keys = list_r2_matches(s3, args.bucket, prefix="matches/")
        logger.info(f"Encontradas {len(all_keys)} partidas no R2")

        if args.skip_existing:
            processed_ids = _get_processed_ids(db)
            logger.info(f"{len(processed_ids)} ja processadas no banco")
            all_keys = [k for k in all_keys if k.split("/")[-1].replace(".json.gz", "") not in processed_ids]
            logger.info(f"{len(all_keys)} restantes apos filtrar")

        to_process = all_keys[:args.count]
        sucesso = erro = dirty = 0

        for i, key in enumerate(to_process):
            match_data = download_and_parse(s3, args.bucket, key)
            if not match_data:
                erro += 1
                continue
            try:
                saved = processar_partida(match_data, db_client=db)
                if saved:
                    sucesso += 1
                else:
                    dirty += 1
                if (i + 1) % 10 == 0:
                    logger.info(f"Partidas: {i + 1}/{len(to_process)} (OK:{sucesso} dirty:{dirty} erro:{erro})")
            except Exception as e:
                logger.error(f"Erro partida {key}: {e}")
                erro += 1

        logger.info(f"=== Partidas concluido: {sucesso} salvas, {dirty} dirty, {erro} erros ===")

    # ── Timelines ─────────────────────────────────────────────────
    if not args.only_matches:
        logger.info(f"=== Timelines: processando ate {args.count} ===")

        tl_keys = list_r2_matches(s3, args.bucket, prefix="timelines/")
        logger.info(f"Encontradas {len(tl_keys)} timelines no R2")

        if args.skip_existing:
            processed_tl = _get_processed_timeline_ids(db)
            logger.info(f"{len(processed_tl)} timelines ja processadas")
            tl_keys = [k for k in tl_keys if k.split("/")[-1].replace(".json.gz", "") not in processed_tl]
            logger.info(f"{len(tl_keys)} restantes apos filtrar")

        to_process_tl = tl_keys[:args.count]
        tl_ok = tl_err = 0

        for i, key in enumerate(to_process_tl):
            tl_data = download_and_parse(s3, args.bucket, key)
            if not tl_data:
                tl_err += 1
                continue
            try:
                saved = processar_timeline(tl_data, db_client=db)
                if saved:
                    tl_ok += 1
                if (i + 1) % 10 == 0:
                    logger.info(f"Timelines: {i + 1}/{len(to_process_tl)} (OK:{tl_ok} erro:{tl_err})")
            except Exception as e:
                logger.error(f"Erro timeline {key}: {e}")
                tl_err += 1

        logger.info(f"=== Timelines concluido: {tl_ok} salvas, {tl_err} erros ===")


if __name__ == "__main__":
    main()
