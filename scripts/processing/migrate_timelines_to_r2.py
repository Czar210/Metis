"""
migrate_timelines_to_r2.py — Move match_timelines do Supabase para o R2.

Lê todos os registros de match_timelines, faz upload para
timelines/{match_id}.json.gz no R2 e reporta o resultado.

Idempotente: pula match_ids cujo arquivo já existe no R2.

Uso:
    python -m scripts.processing.migrate_timelines_to_r2
"""

import gzip
import json
import logging
import os

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("migrate_timelines")


def main() -> None:
    from supabase import create_client
    from scripts.utils.r2_storage import get_r2_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY obrigatórios no .env")

    db = create_client(url, key)
    s3 = get_r2_client()
    bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

    if not s3:
        raise RuntimeError("R2 client indisponível — verifique as credenciais Cloudflare.")

    # Busca todas as timelines do Supabase com paginação
    rows: list[dict] = []
    page_size = 100
    offset = 0
    while True:
        batch = (
            db.table("match_timelines")
            .select("match_id, frames")
            .range(offset, offset + page_size - 1)
            .execute()
            .data or []
        )
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    logger.info(f"{len(rows)} timelines encontradas no Supabase.")

    stats = {"migradas": 0, "puladas": 0, "erros": 0}

    for i, row in enumerate(rows, 1):
        match_id = row["match_id"]
        key = f"timeline_frames/{match_id}.json.gz"

        # Idempotência: pula se já existe no R2
        try:
            s3.head_object(Bucket=bucket, Key=key)
            logger.debug(f"[{i}/{len(rows)}] {match_id} já existe no R2 — pulando.")
            stats["puladas"] += 1
            continue
        except Exception:
            pass

        frames = row.get("frames") or []
        try:
            payload = json.dumps({"match_id": match_id, "frames": frames}, ensure_ascii=False)
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=gzip.compress(payload.encode("utf-8")),
                ContentType="application/gzip",
            )
            logger.info(f"[{i}/{len(rows)}] {match_id} — {len(frames)} frames migrados.")
            stats["migradas"] += 1
        except Exception as e:
            logger.error(f"[{i}/{len(rows)}] {match_id} falhou: {e}")
            stats["erros"] += 1

    logger.info(f"Concluído: {stats}")


if __name__ == "__main__":
    main()
