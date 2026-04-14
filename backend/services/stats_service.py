"""
stats_service.py — Agregações estatísticas sobre match_participants.

Fluxo:
  Supabase (match_participants + matches + players) → filtros → agregação Python → dict de resposta

Nota sobre o filtro ?elo=:
  Elo/tier (Challenger, Diamond, etc.) não está armazenado por partida no schema atual.
  O parâmetro é aceito mas ignorado — será implementado quando a tabela player_ranks existir.
"""

from __future__ import annotations
from collections import defaultdict
from typing import Any


def buscar_patches_disponiveis(db_client) -> list[str]:
    """Retorna lista de patches distintos ordenados do mais recente ao mais antigo."""
    result = db_client.table("matches").select("game_version").execute()
    rows = result.data or []
    patches = sorted(
        {r["game_version"] for r in rows if r.get("game_version")},
        key=lambda v: [int(x) for x in v.split(".")[:2]] if v else [0, 0],
        reverse=True,
    )
    return patches


def buscar_stats_campeao(
    db_client,
    champion: str,
    role: str | None = None,
    server: str | None = None,
    patch: str | None = None,
    min_matches: int = 1,
) -> dict[str, Any]:
    """
    Agrega estatísticas de um campeão a partir do Supabase.

    Retorna sempre 200 — se total_matches < min_matches, retorna stats=None.
    """
    # ── Busca com nested select (FK: match_id → matches, puuid → players) ─────
    query = (
        db_client.table("match_participants")
        .select(
            "champion_name, team_position, win, kills, deaths, assists, "
            "gold_earned, damage_per_minute, kill_participation, "
            "matches(game_version, queue_id), players(server)"
        )
        .ilike("champion_name", champion)
    )

    if role:
        query = query.eq("team_position", role.upper())

    result = query.execute()
    rows: list[dict] = result.data or []

    # ── Filtros Python para campos de tabelas relacionadas ─────────────────────
    if server:
        rows = [
            r for r in rows
            if (r.get("players") or {}).get("server", "").upper() == server.upper()
        ]

    if patch:
        rows = [
            r for r in rows
            if (r.get("matches") or {}).get("game_version") == patch
        ]

    total = len(rows)

    if total < min_matches:
        return {
            "champion": champion,
            "filters": {"role": role, "server": server, "patch": patch},
            "total_matches": total,
            "stats": None,
        }

    # ── Agregação ──────────────────────────────────────────────────────────────
    wins = sum(1 for r in rows if r.get("win"))

    def avg(field: str, default: float = 0.0) -> float:
        return sum(r.get(field, default) for r in rows) / total

    return {
        "champion": champion,
        "filters": {"role": role, "server": server, "patch": patch},
        "total_matches": total,
        "stats": {
            "winrate": round(wins / total * 100, 2),
            "avg_kills": round(avg("kills"), 2),
            "avg_deaths": round(avg("deaths"), 2),
            "avg_assists": round(avg("assists"), 2),
            "avg_gold": round(avg("gold_earned"), 0),
            "avg_damage_per_minute": round(avg("damage_per_minute"), 1),
            "avg_kill_participation": round(avg("kill_participation"), 3),
        },
    }


def buscar_tierlist(
    db_client,
    role: str | None = None,
    server: str | None = None,
    patch: str | None = None,
    patch_list: list[str] | None = None,
    min_matches: int = 1,
) -> list[dict[str, Any]]:
    """
    Agrega estatísticas de TODOS os campeões para montar a Tier List.

    Retorna lista ordenada por winrate desc, apenas campeões com >= min_matches partidas.
    """
    query = (
        db_client.table("match_participants")
        .select(
            "champion_name, team_position, win, kills, deaths, assists, "
            "gold_earned, damage_per_minute, "
            "matches(game_version, queue_id), players(server)"
        )
    )

    if role:
        query = query.eq("team_position", role.upper())

    result = query.execute()
    rows: list[dict] = result.data or []

    # Filtros Python para campos de tabelas relacionadas
    if server:
        rows = [
            r for r in rows
            if (r.get("players") or {}).get("server", "").upper() == server.upper()
        ]
    if patch:
        rows = [
            r for r in rows
            if (r.get("matches") or {}).get("game_version") == patch
        ]
    elif patch_list:
        patch_set = set(patch_list)
        rows = [
            r for r in rows
            if (r.get("matches") or {}).get("game_version") in patch_set
        ]

    # Agrupamento por campeão
    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        name = r.get("champion_name")
        if name:
            buckets[name].append(r)

    result_list: list[dict[str, Any]] = []
    for champion, champ_rows in buckets.items():
        total = len(champ_rows)
        if total < min_matches:
            continue

        wins = sum(1 for r in champ_rows if r.get("win"))

        def avg(field: str) -> float:
            return sum(r.get(field) or 0 for r in champ_rows) / total

        result_list.append({
            "champion": champion,
            "total_matches": total,
            "winrate": round(wins / total * 100, 2),
            "avg_kills": round(avg("kills"), 2),
            "avg_deaths": round(avg("deaths"), 2),
            "avg_assists": round(avg("assists"), 2),
            "avg_gold": round(avg("gold_earned"), 0),
            "avg_damage_per_minute": round(avg("damage_per_minute"), 1),
        })

    result_list.sort(key=lambda x: x["winrate"], reverse=True)

    # ── Tier badges por percentil de winrate ──────────────────────────────────
    if result_list:
        winrates = sorted([c["winrate"] for c in result_list])
        n = len(winrates)

        def percentile(p: float) -> float:
            k = (n - 1) * p
            f = int(k)
            c = f + 1 if f + 1 < n else f
            return winrates[f] + (k - f) * (winrates[c] - winrates[f])

        p95 = percentile(0.95)
        p80 = percentile(0.80)
        p60 = percentile(0.60)
        p40 = percentile(0.40)
        p20 = percentile(0.20)

        for c in result_list:
            wr = c["winrate"]
            if wr >= p95:
                c["tier"] = "S+"
            elif wr >= p80:
                c["tier"] = "S"
            elif wr >= p60:
                c["tier"] = "A"
            elif wr >= p40:
                c["tier"] = "B"
            elif wr >= p20:
                c["tier"] = "C"
            else:
                c["tier"] = "D"

    return result_list
