"""
backfill_enriched_fields.py — Backfill dos campos enriquecidos em match_participants

Problema: antes da v0.6.4, o pipeline batch (process_matches.py) não extraía
items, runas, CS/m, team_id, summoner spells e champion_level. Este script
lê o JSON bruto do R2 de cada partida não enriquecida e atualiza o Supabase.

Estratégia:
  1. Buscar no Supabase os match_ids distintos onde `items IS NULL`
  2. Para cada match_id, baixar o .json.gz do R2 (matches/{match_id}.json.gz)
  3. Extrair somente os 12 campos enriquecidos por participante (função pura)
  4. Upsert em match_participants — só os campos novos, sem sobrescrever os antigos
  5. Reportar progresso com contadores

Uso:
    python scripts/processing/backfill_enriched_fields.py
    python scripts/processing/backfill_enriched_fields.py --dry-run
    python scripts/processing/backfill_enriched_fields.py --batch-size 25
"""

import os
import io
import sys
import json
import gzip
import argparse
import logging
from pathlib import Path
from dotenv import load_dotenv

# Garante que a raiz do projeto está no path ao rodar o script diretamente
sys.path.insert(0, str(Path(__file__).parents[2]))

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BUCKET_NAME  = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

# ─────────────────────────────────────────────────────────────────────────────
# Extração pura — somente os campos enriquecidos
# ─────────────────────────────────────────────────────────────────────────────

def _extrair_campos_enriquecidos(match_json: dict) -> list[dict]:
    """
    Extrai os 12 campos enriquecidos de cada participante do JSON bruto.
    Retorna lista de dicts com match_id + puuid + campos novos prontos para upsert.
    Retorna lista vazia se o JSON estiver corrompido.
    """
    metadata = match_json.get("metadata", {})
    info     = match_json.get("info", {})

    match_id = metadata.get("matchId")
    if not match_id or not info:
        return []

    game_duration = info.get("gameDuration", 0)
    rows: list[dict] = []

    for p in info.get("participants", []):
        puuid = p.get("puuid", "")
        if not puuid or puuid.startswith("BOT_") or p.get("botPlayer", False):
            continue

        # ── Items (slots 0-6) ─────────────────────────────────────────────
        items = [p.get(f"item{i}", 0) for i in range(7)]

        # ── Runas ─────────────────────────────────────────────────────────
        perks        = p.get("perks", {})
        styles       = perks.get("styles", [])
        primary      = styles[0] if styles else {}
        secondary    = styles[1] if len(styles) > 1 else {}
        primary_sels = primary.get("selections") or []
        keystone     = primary_sels[0].get("perk") if primary_sels else None

        # ── CS/m ──────────────────────────────────────────────────────────
        total_cs = p.get("totalMinionsKilled", 0) + p.get("neutralMinionsKilled", 0)
        cspm     = round(total_cs / (game_duration / 60), 2) if game_duration > 0 else 0.0

        rows.append({
            "match_id":        match_id,
            "puuid":           puuid,
            "team_id":         p.get("teamId"),
            "items":           items,
            "summoner1_id":    p.get("summoner1Id"),
            "summoner2_id":    p.get("summoner2Id"),
            "rune_keystone":   keystone,
            "rune_primary":    primary.get("style"),
            "rune_secondary":  secondary.get("style"),
            "runes_raw":       perks,
            "total_cs":        total_cs,
            "cs_per_minute":   float(cspm),
            "champion_level":  p.get("champLevel", 1),
            "items_purchased": p.get("itemsPurchased", 0),
        })

    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Supabase — buscar match_ids pendentes (paginado)
# ─────────────────────────────────────────────────────────────────────────────

def _buscar_match_ids_pendentes(db_client) -> list[str]:
    """
    Retorna lista de match_ids distintos onde `items IS NULL`.
    Usa paginação para não ser limitado pelo teto do PostgREST.
    """
    ids: list[str] = []
    page_size = 1000
    offset    = 0

    logger.info("Buscando match_ids com campos não enriquecidos no Supabase...")

    while True:
        result = (
            db_client.table("match_participants")
            .select("match_id")
            .is_("items", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        seen  = set()
        for row in batch:
            mid = row["match_id"]
            if mid not in seen:
                seen.add(mid)
                ids.append(mid)
        if len(batch) < page_size:
            break
        offset += page_size

    # Deduplica preservando ordem
    seen_all: set[str] = set()
    unique: list[str] = []
    for mid in ids:
        if mid not in seen_all:
            seen_all.add(mid)
            unique.append(mid)

    logger.info(f"  {len(unique)} partidas pendentes encontradas.")
    return unique


# ─────────────────────────────────────────────────────────────────────────────
# R2 — download + descompressão
# ─────────────────────────────────────────────────────────────────────────────

def _baixar_json(s3_client, match_id: str) -> dict | None:
    key = f"matches/{match_id}.json.gz"
    try:
        response  = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
        compressed = response["Body"].read()
        with gzip.open(io.BytesIO(compressed), "rt", encoding="utf-8") as f:
            return json.load(f)
    except s3_client.exceptions.NoSuchKey:
        return None
    except Exception as e:
        logger.warning(f"  [{match_id}] Falha no download: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Loop principal
# ─────────────────────────────────────────────────────────────────────────────

def rodar_backfill(
    s3_client=None,
    db_client=None,
    batch_size: int = 50,
    dry_run: bool = False,
) -> dict:
    """
    Loop completo de backfill.

    Args:
        s3_client:  cliente boto3 S3/R2. Criado automaticamente se None.
        db_client:  cliente Supabase. Criado automaticamente se None.
        batch_size: quantas partidas processar por vez antes de fazer upsert.
        dry_run:    se True, não escreve nada no Supabase.

    Retorna: {"ok": int, "sem_r2": int, "erros": int, "total": int}
    """
    from scripts.utils.r2_storage import get_r2_client
    from supabase import create_client

    if s3_client is None:
        s3_client = get_r2_client()
    if s3_client is None:
        logger.error("R2 client não disponível — verifique as variáveis de ambiente.")
        return {"ok": 0, "sem_r2": 0, "erros": 0, "total": 0}

    if db_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("SUPABASE_URL e SUPABASE_KEY obrigatórios no .env")
            return {"ok": 0, "sem_r2": 0, "erros": 0, "total": 0}
        db_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    if dry_run:
        logger.info("*** DRY RUN — nenhum dado será gravado no Supabase ***")

    match_ids = _buscar_match_ids_pendentes(db_client)
    total = len(match_ids)

    if total == 0:
        logger.info("Nenhuma partida pendente. Tudo já está enriquecido!")
        return {"ok": 0, "sem_r2": 0, "erros": 0, "total": 0}

    stats = {"ok": 0, "sem_r2": 0, "erros": 0, "total": total}
    upsert_buffer: list[dict] = []

    def _flush(buffer: list[dict]) -> int:
        """Faz upsert do buffer e retorna quantos rows foram enviados."""
        if not buffer or dry_run:
            return len(buffer)
        try:
            db_client.table("match_participants").upsert(
                buffer, on_conflict="match_id,puuid"
            ).execute()
            return len(buffer)
        except Exception as e:
            logger.error(f"  Erro no upsert do batch: {e}")
            return 0

    logger.info(f"Iniciando backfill de {total} partidas (batch_size={batch_size})...")

    for i, match_id in enumerate(match_ids, 1):
        pct = f"{i}/{total} ({i*100//total}%)"

        match_json = _baixar_json(s3_client, match_id)
        if match_json is None:
            logger.warning(f"  [{pct}] {match_id} — não encontrado no R2, pulando.")
            stats["sem_r2"] += 1
            continue

        rows = _extrair_campos_enriquecidos(match_json)
        if not rows:
            logger.warning(f"  [{pct}] {match_id} — JSON inválido ou sem participantes.")
            stats["erros"] += 1
            continue

        upsert_buffer.extend(rows)
        logger.info(f"  [{pct}] {match_id} — {len(rows)} participantes extraídos.")

        # Flush quando bate o batch_size
        if len(upsert_buffer) >= batch_size * 10:  # ~10 participantes por partida
            sent = _flush(upsert_buffer)
            stats["ok"] += sent // 10  # aprox. partidas
            upsert_buffer.clear()

    # Flush final
    if upsert_buffer:
        _flush(upsert_buffer)
        stats["ok"] += total - stats["sem_r2"] - stats["erros"]

    logger.info(
        f"\n{'[DRY RUN] ' if dry_run else ''}Backfill concluído: "
        f"{stats['ok']} ok | {stats['sem_r2']} sem R2 | {stats['erros']} erros | {total} total"
    )
    return stats


# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill de campos enriquecidos em match_participants")
    parser.add_argument("--dry-run",    action="store_true", help="Mostra o que seria feito sem gravar")
    parser.add_argument("--batch-size", type=int, default=50, help="Partidas por batch de upsert (default: 50)")
    args = parser.parse_args()

    rodar_backfill(batch_size=args.batch_size, dry_run=args.dry_run)
