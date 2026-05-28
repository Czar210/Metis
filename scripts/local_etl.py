"""
local_etl.py  ETL local: processa partidas e timelines do R2 -> Supabase.

Uso:
    python scripts/local_etl.py --count 500 --skip-existing
    python scripts/local_etl.py --count 1000 --skip-existing --refresh-cache
    python scripts/local_etl.py --count 200 --only-timelines
"""

import argparse
import logging
import os
import sys
import json
import gzip
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client
from scripts.processing.process_matches import processar_partida, _get_processed_ids
from scripts.processing.process_timelines import processar_timeline

#  Logging: erros vao pro arquivo, terminal fica limpo 
LOG_FILE = os.path.join(os.path.dirname(__file__), "..", "etl.log")

file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))

# Silenciar httpx/httpcore/supabase no terminal
for noisy in ["httpx", "httpcore", "hpack", "supabase", "realtime", "postgrest"]:
    logging.getLogger(noisy).setLevel(logging.WARNING)

logger = logging.getLogger("etl")
logger.setLevel(logging.DEBUG)
logger.addHandler(file_handler)

# Handler de terminal so pra CRITICAL (nada aparece  tqdm cuida da UI)
console = logging.StreamHandler()
console.setLevel(logging.CRITICAL)
logger.addHandler(console)


def get_r2_client():
    import boto3
    account_id = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
    access_key = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    if not all([account_id, access_key, secret_key]):
        print("Variaveis R2 nao configuradas no .env")
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
        print("SUPABASE_URL e SUPABASE_KEY nao configurados no .env")
        return None
    return create_client(url, key)


def list_r2_keys(s3, bucket: str, prefix: str) -> list[str]:
    """Lista TODOS os JSONs no R2 (com paginacao). Mais recentes primeiro."""
    paginator = s3.get_paginator("list_objects_v2")
    items = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith(".json.gz"):
                items.append((obj["Key"], obj.get("LastModified")))
    items.sort(key=lambda x: x[1] or "", reverse=True)
    return [k for k, _ in items]


def download(s3, bucket: str, key: str) -> dict | None:
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        return json.loads(gzip.decompress(obj["Body"].read()))
    except Exception as e:
        logger.error(f"Download falhou {key}: {e}")
        return None


def _get_processed_timeline_ids(db) -> set[str]:
    try:
        result = db.table("processed_timelines").select("match_id").execute()
        return {r["match_id"] for r in (result.data or [])}
    except Exception:
        return set()


def main():
    try:
        from tqdm import tqdm
    except ImportError:
        print("Instalando tqdm...")
        os.system(f"{sys.executable} -m pip install tqdm -q")
        from tqdm import tqdm

    parser = argparse.ArgumentParser(description="Metis ETL  processa partidas e timelines do R2")
    parser.add_argument("--count", type=int, default=50, help="Itens a processar (default: 50)")
    parser.add_argument("--skip-existing", action="store_true", help="Pular ja processados")
    parser.add_argument("--bucket", default="metis", help="Bucket R2 (default: metis)")
    parser.add_argument("--only-matches", action="store_true", help="So partidas")
    parser.add_argument("--only-timelines", action="store_true", help="So timelines")
    parser.add_argument("--refresh-cache", action="store_true", help="Atualizar tier list ao terminar")
    parser.add_argument("--api-url", default="http://localhost:8000", help="URL do backend")
    parser.add_argument("--api-key", default=os.environ.get("METIS_API_KEY", ""), help="API key")
    args = parser.parse_args()

    s3 = get_r2_client()
    db = get_supabase()
    if not s3 or not db:
        sys.exit(1)

    print(f"\n  Metis ETL  {datetime.now().strftime('%H:%M:%S')}")
    print(f"  Log completo: {os.path.abspath(LOG_FILE)}\n")

    #  Listar e parear partidas + timelines 
    print("  Listando arquivos no R2...")

    match_keys = [] if args.only_timelines else list_r2_keys(s3, args.bucket, "matches/")
    tl_keys = [] if args.only_matches else list_r2_keys(s3, args.bucket, "timelines/")

    if args.skip_existing:
        if match_keys:
            processed = _get_processed_ids(db)
            match_keys = [k for k in match_keys if k.split("/")[-1].replace(".json.gz", "") not in processed]
        if tl_keys:
            processed_tl = _get_processed_timeline_ids(db)
            tl_keys = [k for k in tl_keys if k.split("/")[-1].replace(".json.gz", "") not in processed_tl]

    # Montar mapa de match_id -> timeline key pra parear
    tl_map: dict[str, str] = {}
    for k in tl_keys:
        mid = k.split("/")[-1].replace(".json.gz", "")
        tl_map[mid] = k

    # Lista final: cada item = (match_key, timeline_key ou None)
    pairs: list[tuple[str | None, str | None]] = []
    seen_tl: set[str] = set()

    for mk in match_keys[:args.count]:
        mid = mk.split("/")[-1].replace(".json.gz", "")
        tk = tl_map.get(mid)
        pairs.append((mk, tk))
        if tk:
            seen_tl.add(mid)

    # Timelines orfas (sem match correspondente)  so se --only-timelines
    if args.only_timelines:
        for tk in tl_keys[:args.count]:
            mid = tk.split("/")[-1].replace(".json.gz", "")
            if mid not in seen_tl:
                pairs.append((None, tk))

    ok = dirty = err = tl_ok = tl_err = 0

    with tqdm(pairs, desc="  ETL", unit="par", ncols=90) as pbar:
        for match_key, tl_key in pbar:
            # Processar partida
            if match_key:
                data = download(s3, args.bucket, match_key)
                if data:
                    try:
                        saved = processar_partida(data, db_client=db)
                        if saved:
                            ok += 1
                        else:
                            dirty += 1
                    except Exception as e:
                        logger.error(f"Partida {match_key}: {e}")
                        err += 1
                else:
                    err += 1

            # Processar timeline correspondente logo em seguida
            if tl_key:
                tl_data = download(s3, args.bucket, tl_key)
                if tl_data:
                    try:
                        saved = processar_timeline(tl_data, db_client=db)
                        if saved:
                            tl_ok += 1
                    except Exception as e:
                        logger.error(f"Timeline {tl_key}: {e}")
                        tl_err += 1
                else:
                    tl_err += 1

            pbar.set_postfix_str(f"ok:{ok} dirty:{dirty} tl:{tl_ok} err:{err+tl_err}")

    logger.info(f"ETL: {ok} partidas salvas, {dirty} dirty, {tl_ok} timelines, {err + tl_err} erros")
    print(f"  Resultado: {ok} partidas, {dirty} dirty, {tl_ok} timelines, {err + tl_err} erros\n")

    #  Refresh cache 
    if args.refresh_cache and args.api_key:
        print("  Atualizando tier list...", end=" ")
        try:
            import requests
            res = requests.post(
                f"{args.api_url}/api/v1/admin/refresh-cache",
                headers={"X-API-Key": args.api_key},
                timeout=10,
            )
            if res.ok:
                d = res.json()
                print(f"OK ({d.get('cleared', 0)} entradas)")
            else:
                print(f"Falhou (HTTP {res.status_code})")
        except Exception as e:
            print(f"Erro ({e})")

    print("  Concluido.\n")


if __name__ == "__main__":
    main()
