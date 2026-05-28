"""
compute_stats.py — Pre-computa estatisticas agregadas por patch e salva no R2.

Gera dois arquivos por patch:
  stats/{patch}/champion_stats.json.gz  — winrate/KDA/pickrate/banrate por (champion, role)
  stats/{patch}/item_stats.json.gz      — picks/wins por (item_id, role)

Rodado via GitHub Action apos process_timelines (cron 16:00 UTC).
Idempotente: pula patches cujos arquivos foram gerados nas ultimas 23h.

Uso:
    python -m scripts.processing.compute_stats
"""

import gzip
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
PATCHES_LIMIT = int(os.environ.get("PATCHES_LIMIT", 3))
_FRESHNESS_HOURS = 23


def _get_recent_patches(db_client, limit: int) -> list[str]:
    result = db_client.table("matches").select("game_version").execute()
    rows = result.data or []
    patches = sorted(
        {r["game_version"] for r in rows if r.get("game_version")},
        key=lambda v: [int(x) for x in v.split(".")[:2]] if v else [0, 0],
        reverse=True,
    )
    return patches[:limit]


def _file_is_fresh(s3_client, key: str) -> bool:
    try:
        head = s3_client.head_object(Bucket=BUCKET_NAME, Key=key)
        last_modified = head["LastModified"]
        age = datetime.now(timezone.utc) - last_modified
        return age < timedelta(hours=_FRESHNESS_HOURS)
    except Exception:
        return False


def _upload_json_gz(s3_client, data: dict, key: str) -> bool:
    try:
        compressed = gzip.compress(
            json.dumps(data, ensure_ascii=False).encode("utf-8")
        )
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=key,
            Body=compressed,
            ContentType="application/gzip",
        )
        logger.info("Upload OK: %s", key)
        return True
    except Exception as e:
        logger.error("Upload falhou %s: %s", key, e)
        return False


def _paginar_todos_participants(db_client) -> list[dict]:
    """Busca todos os match_participants com os campos necessarios para agregacao."""
    select_cols = (
        "match_id, champion_name, team_position, win, items, "
        "kills, deaths, assists, gold_earned, damage_per_minute, "
        "kill_participation, matches(game_version, bans)"
    )
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        result = (
            db_client.table("match_participants")
            .select(select_cols)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def _compute_champion_stats(rows: list[dict], patch: str) -> dict:
    all_match_ids = {r.get("match_id") for r in rows if r.get("match_id")}
    total_unique_matches = len(all_match_ids) or 1

    # Contagem de bans dedupliacada por partida
    ban_counts: dict[str, int] = defaultdict(int)
    seen_bans: set[str] = set()
    for r in rows:
        bans = (r.get("matches") or {}).get("bans") or []
        mid = r.get("match_id", "")
        for ban in bans:
            cname = ban.get("champion_name", "")
            ban_key = f"{mid}|{cname}"
            if cname and ban_key not in seen_bans:
                ban_counts[cname] += 1
                seen_bans.add(ban_key)

    # Agrupamento por (champion, role)
    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        name = r.get("champion_name")
        pos = r.get("team_position", "UNKNOWN")
        if name and pos and pos != "UNKNOWN":
            buckets[f"{name}|{pos}"].append(r)

    # Total de partidas por campeo (para role_share)
    matches_per_champion: dict[str, int] = defaultdict(int)
    for key, champ_rows in buckets.items():
        champion, _ = key.split("|", 1)
        matches_per_champion[champion] += len(champ_rows)

    champions = []
    for key, champ_rows in buckets.items():
        champion, role = key.split("|", 1)
        total = len(champ_rows)
        wins = sum(1 for r in champ_rows if r.get("win"))
        champ_total = matches_per_champion[champion] or 1

        def avg(field: str) -> float:
            return sum(r.get(field) or 0.0 for r in champ_rows) / total

        champions.append({
            "champion": champion,
            "role": role,
            "total_matches": total,
            "wins": wins,
            "role_share": round(total / champ_total * 100, 1),
            "avg_kills": round(avg("kills"), 2),
            "avg_deaths": round(avg("deaths"), 2),
            "avg_assists": round(avg("assists"), 2),
            "avg_gold": round(avg("gold_earned"), 0),
            "avg_damage_per_minute": round(avg("damage_per_minute"), 1),
            "avg_kill_participation": round(avg("kill_participation"), 3),
        })

    return {
        "patch": patch,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_unique_matches": total_unique_matches,
        "ban_counts": dict(ban_counts),
        "champions": champions,
    }


def _compute_item_stats(rows: list[dict], patch: str) -> dict:
    # Buckets: role -> item_id -> {picks, wins}
    # "ALL" agrega todas as roles
    buckets: dict[str, dict[int, dict]] = defaultdict(
        lambda: defaultdict(lambda: {"picks": 0, "wins": 0})
    )

    for row in rows:
        items = row.get("items")
        if not items or not isinstance(items, list):
            continue
        win = row.get("win", False)
        role = row.get("team_position") or "UNKNOWN"
        if role == "UNKNOWN":
            continue
        for item_id in items[:6]:  # slot 6 = trinket
            if not item_id or item_id == 0:
                continue
            buckets["ALL"][item_id]["picks"] += 1
            if win:
                buckets["ALL"][item_id]["wins"] += 1
            buckets[role][item_id]["picks"] += 1
            if win:
                buckets[role][item_id]["wins"] += 1

    by_role: dict[str, list[dict]] = {}
    for role, items_dict in buckets.items():
        by_role[role] = sorted(
            [
                {"item_id": item_id, "picks": d["picks"], "wins": d["wins"]}
                for item_id, d in items_dict.items()
            ],
            key=lambda x: x["picks"],
            reverse=True,
        )

    return {
        "patch": patch,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "by_role": by_role,
    }


def rodar_compute_stats(
    s3_client=None, db_client=None, patches_limit: int = PATCHES_LIMIT
) -> dict:
    from scripts.utils.r2_storage import get_r2_client
    from supabase import create_client

    if s3_client is None:
        s3_client = get_r2_client()
    if s3_client is None:
        print("ERRO: R2 client nao disponivel.")
        return {"processados": 0, "ignorados": 0, "erros": 0}

    if db_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERRO: Credenciais do Supabase nao encontradas.")
            return {"processados": 0, "ignorados": 0, "erros": 0}
        db_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    patches = _get_recent_patches(db_client, patches_limit)
    print(f"Patches candidatos: {patches}")

    stale_patches = [
        p for p in patches
        if not (
            _file_is_fresh(s3_client, f"stats/{p}/champion_stats.json.gz")
            and _file_is_fresh(s3_client, f"stats/{p}/item_stats.json.gz")
        )
    ]

    result = {"processados": 0, "ignorados": len(patches) - len(stale_patches), "erros": 0}

    if not stale_patches:
        print("Todos os patches tem arquivos frescos no R2. Encerrando.")
        print(f"Resultado: {result}")
        return result

    print(f"Patches desatualizados: {stale_patches}")
    print("Carregando match_participants do Supabase...")
    rows = _paginar_todos_participants(db_client)
    print(f"   {len(rows)} participantes carregados.")

    # Separa por patch em uma unica passagem
    stale_set = set(stale_patches)
    by_patch: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        patch = (r.get("matches") or {}).get("game_version")
        if patch in stale_set:
            by_patch[patch].append(r)

    for patch in stale_patches:
        patch_rows = by_patch.get(patch, [])
        if not patch_rows:
            print(f"Patch {patch}: sem dados no Supabase. Ignorando.")
            result["ignorados"] += 1
            continue

        print(f"Patch {patch}: {len(patch_rows)} participantes — computando...")
        champ_data = _compute_champion_stats(patch_rows, patch)
        item_data = _compute_item_stats(patch_rows, patch)

        ok_champ = _upload_json_gz(
            s3_client, champ_data, f"stats/{patch}/champion_stats.json.gz"
        )
        ok_item = _upload_json_gz(
            s3_client, item_data, f"stats/{patch}/item_stats.json.gz"
        )

        if ok_champ and ok_item:
            result["processados"] += 1
            total_item_entries = sum(len(v) for v in item_data.get("by_role", {}).values())
            print(
                f"Patch {patch}: {len(champ_data['champions'])} entradas de campeo, "
                f"{len(champ_data.get('ban_counts', {}))} campeoes banidos, "
                f"{total_item_entries} entradas de item."
            )
        else:
            result["erros"] += 1

    print(f"Resultado: {result}")
    return result


if __name__ == "__main__":
    rodar_compute_stats()
