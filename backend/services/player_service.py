"""
player_service.py — Agregações de dados do jogador.

Endpoints suportados:
  champion-stats   → stats do jogador por campeão (winrate, KDA, CS/m)
  frequent-allies  → jogadores que apareceram no mesmo time ≥3 vezes
  nemesis          → oponentes enfrentados ≥2 vezes
"""

from __future__ import annotations
from collections import defaultdict
from typing import Any


# Temporadas de 2026 (8 patches cada)
SEASONS: dict[str, list[str]] = {
    "S1-2026": [f"16.{i}" for i in range(1, 9)],     # 16.1 a 16.8
    "S2-2026": [f"16.{i}" for i in range(9, 17)],     # 16.9 a 16.16
    "S3-2026": [f"16.{i}" for i in range(17, 25)],    # 16.17 a 16.24
}


def _get_season_patches(season: str | None) -> set[str] | None:
    if not season:
        return None
    return set(SEASONS.get(season, []))


def buscar_champion_stats_jogador(
    db_client,
    puuid: str,
    queue_id: int | None = None,
    role: str | None = None,
    patch: str | None = None,
    season: str | None = None,
) -> list[dict[str, Any]]:
    """
    Agrega stats do jogador por campeão.

    Filtros: queue_id, role, patch (unico), season (S1-2026, etc.)
    Retorna lista ordenada por games desc.
    """
    query = (
        db_client.table("match_participants")
        .select(
            "champion_name, team_position, win, kills, deaths, assists, cs_per_minute, "
            "matches(queue_id, game_version)"
        )
        .eq("puuid", puuid)
    )

    if role:
        query = query.eq("team_position", role.upper())

    rows: list[dict] = query.execute().data or []

    if queue_id:
        rows = [r for r in rows if (r.get("matches") or {}).get("queue_id") == queue_id]

    if patch:
        rows = [r for r in rows if (r.get("matches") or {}).get("game_version") == patch]
    elif season:
        season_patches = _get_season_patches(season)
        if season_patches:
            rows = [r for r in rows if (r.get("matches") or {}).get("game_version") in season_patches]

    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        name = r.get("champion_name")
        if name:
            buckets[name].append(r)

    result: list[dict[str, Any]] = []
    for champion, champ_rows in buckets.items():
        total = len(champ_rows)
        wins = sum(1 for r in champ_rows if r.get("win"))

        def avg(field: str) -> float:
            return sum(r.get(field) or 0 for r in champ_rows) / total

        result.append({
            "champion": champion,
            "games": total,
            "wins": wins,
            "winrate": round(wins / total * 100, 1),
            "avg_kills": round(avg("kills"), 1),
            "avg_deaths": round(avg("deaths"), 1),
            "avg_assists": round(avg("assists"), 1),
            "avg_cs_per_minute": round(avg("cs_per_minute"), 1),
        })

    result.sort(key=lambda x: x["games"], reverse=True)
    return result


def buscar_frequent_allies(
    db_client,
    puuid: str,
    min_games: int = 3,
) -> list[dict[str, Any]]:
    """
    Jogadores que apareceram no mesmo time que o jogador em ≥min_games partidas.
    """
    # Passo 1: partidas do jogador
    my_rows: list[dict] = (
        db_client.table("match_participants")
        .select("match_id, team_id")
        .eq("puuid", puuid)
        .execute()
        .data or []
    )

    if not my_rows:
        return []

    my_by_match = {r["match_id"]: r["team_id"] for r in my_rows}
    match_ids = list(my_by_match.keys())[:200]

    # Passo 2: todos os participantes dessas partidas
    all_rows: list[dict] = (
        db_client.table("match_participants")
        .select("match_id, puuid, team_id, win, players(game_name, tag_line, server)")
        .in_("match_id", match_ids)
        .execute()
        .data or []
    )

    # Passo 3: agrupar aliados (mesmo team_id, puuid diferente)
    buckets: dict[str, dict] = defaultdict(lambda: {"games": 0, "wins": 0, "info": None})

    for row in all_rows:
        mid = row.get("match_id")
        my_team = my_by_match.get(mid)
        if not my_team:
            continue
        if row.get("team_id") != my_team:
            continue
        ally_puuid = row.get("puuid")
        if not ally_puuid or ally_puuid == puuid:
            continue

        buckets[ally_puuid]["games"] += 1
        if row.get("win"):
            buckets[ally_puuid]["wins"] += 1
        if not buckets[ally_puuid]["info"] and row.get("players"):
            buckets[ally_puuid]["info"] = row["players"]

    result: list[dict[str, Any]] = []
    for ally_puuid, d in buckets.items():
        if d["games"] < min_games:
            continue
        info = d["info"] or {}
        result.append({
            "puuid": ally_puuid,
            "game_name": info.get("game_name", "???"),
            "tag_line": info.get("tag_line", ""),
            "server": info.get("server"),
            "games_together": d["games"],
            "wins_together": d["wins"],
            "winrate": round(d["wins"] / d["games"] * 100, 1),
        })

    result.sort(key=lambda x: x["games_together"], reverse=True)
    return result


def buscar_nemesis(
    db_client,
    puuid: str,
    min_games: int = 2,
) -> list[dict[str, Any]]:
    """
    Oponentes enfrentados ≥min_games vezes (mesmo match, team_id diferente).
    """
    # Passo 1: partidas do jogador
    my_rows: list[dict] = (
        db_client.table("match_participants")
        .select("match_id, team_id, win")
        .eq("puuid", puuid)
        .execute()
        .data or []
    )

    if not my_rows:
        return []

    my_by_match = {r["match_id"]: {"team_id": r["team_id"], "win": r["win"]} for r in my_rows}
    match_ids = list(my_by_match.keys())[:200]

    # Passo 2: todos os participantes
    all_rows: list[dict] = (
        db_client.table("match_participants")
        .select("match_id, puuid, team_id, champion_name, players(game_name, tag_line, server)")
        .in_("match_id", match_ids)
        .execute()
        .data or []
    )

    # Passo 3: agrupar oponentes (team_id diferente)
    buckets: dict[str, dict] = defaultdict(lambda: {"times_faced": 0, "my_wins": 0, "info": None, "champions": set()})

    for row in all_rows:
        mid = row.get("match_id")
        my_data = my_by_match.get(mid)
        if not my_data:
            continue
        if row.get("team_id") == my_data["team_id"]:
            continue
        opp_puuid = row.get("puuid")
        if not opp_puuid:
            continue

        buckets[opp_puuid]["times_faced"] += 1
        if my_data["win"]:
            buckets[opp_puuid]["my_wins"] += 1
        if row.get("champion_name"):
            buckets[opp_puuid]["champions"].add(row["champion_name"])
        if not buckets[opp_puuid]["info"] and row.get("players"):
            buckets[opp_puuid]["info"] = row["players"]

    result: list[dict[str, Any]] = []
    for opp_puuid, d in buckets.items():
        if d["times_faced"] < min_games:
            continue
        info = d["info"] or {}
        result.append({
            "puuid": opp_puuid,
            "game_name": info.get("game_name", "???"),
            "tag_line": info.get("tag_line", ""),
            "server": info.get("server"),
            "times_faced": d["times_faced"],
            "wins_against": d["my_wins"],
            "winrate_against": round(d["my_wins"] / d["times_faced"] * 100, 1),
            "champions_used": sorted(d["champions"]),
        })

    result.sort(key=lambda x: x["times_faced"], reverse=True)
    return result
