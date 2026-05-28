"""
backfill_timeline_events.py

Reprocessa critical_events para timelines que foram processadas antes do
Bloco 0 (ITEM_PURCHASED + SKILL_LEVEL_UP). Nao toca participant_snapshots.

Uso:
    python -m scripts.processing.backfill_timeline_events

Variaveis de ambiente necessarias (mesmo conjunto do process_timelines):
    SUPABASE_URL, SUPABASE_KEY
    CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY
    CLOUDFLARE_R2_BUCKET_NAME  (padrao: metis)
    BATCH_SIZE                 (padrao: 50)
"""

import os
import json
import gzip
import io
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 50))


def _paginar(db_client, table: str, select: str, filters: dict | None = None) -> list[dict]:
    """Busca todas as linhas de uma tabela com paginacao automatica."""
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        query = db_client.table(table).select(select)
        if filters:
            for col, val in filters.items():
                query = query.eq(col, val)
        result = query.range(offset, offset + page_size - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def _check_has_items_in_batches(db_client, match_ids: list[str], batch_size: int = 200) -> set[str]:
    """
    Verifica quais match_ids ja tem ITEM_PURCHASED em critical_events.
    Usa .in_() em lotes para evitar timeout de full-scan na tabela grande.
    """
    has_items: set[str] = set()
    total = len(match_ids)
    for i in range(0, total, batch_size):
        batch = match_ids[i : i + batch_size]
        rows = (
            db_client.table("critical_events")
            .select("match_id")
            .eq("event_type", "ITEM_PURCHASED")
            .in_("match_id", batch)
            .limit(len(batch))
            .execute()
            .data or []
        )
        has_items.update(r["match_id"] for r in rows)
        print(f"   Checando lote {i // batch_size + 1}/{(total + batch_size - 1) // batch_size}...", end="\r")
    print()
    return has_items


def _get_match_ids_needing_backfill(db_client) -> list[str]:
    """
    Retorna match_ids que estao em processed_timelines, existem na tabela matches
    (Silver), e ainda nao tem nenhum evento ITEM_PURCHASED em critical_events.
    """
    print("Buscando match_ids em processed_timelines...")
    processed_rows = _paginar(db_client, "processed_timelines", "match_id")
    processed_ids = {row["match_id"] for row in processed_rows}
    print(f"   {len(processed_ids)} timelines processadas encontradas.")

    if not processed_ids:
        return []

    print("Buscando match_ids presentes na tabela matches (Silver)...")
    matches_rows = _paginar(db_client, "matches", "match_id")
    valid_match_ids = {row["match_id"] for row in matches_rows}
    print(f"   {len(valid_match_ids)} partidas na camada Silver.")

    phantoms = processed_ids - valid_match_ids
    if phantoms:
        print(f"   {len(phantoms)} timelines sem partida no Silver — ignoradas (sem FK).")

    eligible_ids = sorted(processed_ids & valid_match_ids)

    print(f"Checando {len(eligible_ids)} eligible matches contra critical_events em lotes...")
    has_items = _check_has_items_in_batches(db_client, eligible_ids)
    print(f"   {len(has_items)} ja tem ITEM_PURCHASED.")

    needs_backfill = sorted(set(eligible_ids) - has_items)
    print(f"   {len(needs_backfill)} precisam de backfill.")
    return needs_backfill


def _reprocessar_critical_events(timeline_json_data: dict, db_client) -> bool:
    """
    Re-extrai e re-insere critical_events para um match_id.
    Preserva participant_snapshots (nao toca).
    """
    from scripts.processing.process_timelines import extrair_dados_timeline

    match_id, _, events_payload = extrair_dados_timeline(timeline_json_data)
    if not match_id:
        return False

    try:
        db_client.table("critical_events").delete().eq("match_id", match_id).execute()
        if events_payload:
            db_client.table("critical_events").insert(events_payload).execute()
        return True
    except Exception as e:
        logger.error("Backfill %s: %s", match_id, e)
        return False


def rodar_backfill(s3_client=None, db_client=None, batch_size: int = BATCH_SIZE) -> dict:
    from scripts.utils.r2_storage import get_r2_client
    from supabase import create_client

    if s3_client is None:
        s3_client = get_r2_client()
    if s3_client is None:
        print("ERRO: R2 client nao disponivel.")
        return {"reprocessadas": 0, "erros": 0}

    if db_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERRO: Credenciais do Supabase nao encontradas.")
            return {"reprocessadas": 0, "erros": 0}
        db_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

    needs_backfill = _get_match_ids_needing_backfill(db_client)

    if not needs_backfill:
        print("Nenhuma timeline precisa de backfill. Encerrando.")
        return {"reprocessadas": 0, "erros": 0}

    batch = needs_backfill[:batch_size]
    print(f"Processando batch de {len(batch)} timelines (total pendente: {len(needs_backfill)})...")

    stats = {"reprocessadas": 0, "erros": 0}

    for i, match_id in enumerate(batch, 1):
        key = f"timelines/{match_id}.json.gz"
        print(f"[{i}/{len(batch)}] {match_id}", end="  ")

        try:
            response = s3_client.get_object(Bucket=bucket, Key=key)
            compressed = response["Body"].read()
            with gzip.open(io.BytesIO(compressed), "rt", encoding="utf-8") as f:
                timeline_json = json.load(f)
        except Exception as e:
            print(f"ERRO ao baixar: {e}")
            stats["erros"] += 1
            continue

        ok = _reprocessar_critical_events(timeline_json, db_client)
        if ok:
            stats["reprocessadas"] += 1
            print("OK")
        else:
            stats["erros"] += 1
            print("ERRO")

    remaining = len(needs_backfill) - len(batch)
    if remaining > 0:
        print(f"Ainda restam {remaining} timelines. Rode novamente para continuar.")

    print(f"Resultado: {stats}")
    return stats


if __name__ == "__main__":
    rodar_backfill()
