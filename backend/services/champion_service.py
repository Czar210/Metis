"""
champion_service.py — Agregações estatísticas por campeão.

Endpoints suportados:
  overview   → stats médias (winrate, KDA, DPM, CS/m, KP, gold) com filtros
  builds     → itens mais frequentes via view champion_item_stats
  matchups   → winrate do campeão contra cada oponente na mesma lane
  synergies  → winrate do campeão junto a cada aliado
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

_EXCLUDED_CATEGORIES = {"STARTER", "CONSUMABLE", "COMPONENT"}


def _wilson_lower(picks: int, wins: int, z: float = 1.96) -> float:
    """Wilson score lower bound — estimativa conservadora de winrate real."""
    if picks == 0:
        return 0.0
    p = wins / picks
    n = picks
    return (p + z * z / (2 * n) - z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n)


def _load_item_categories(db_client) -> dict[int, str | None]:
    """Retorna {item_id: category} carregado da tabela items."""
    rows = (
        db_client.table("items")
        .select("item_id, category")
        .execute()
        .data or []
    )
    return {int(r["item_id"]): r.get("category") for r in rows}


# ── Overview ──────────────────────────────────────────────────────────────────

def buscar_overview(
    db_client,
    champion: str,
    role: str | None = None,
    server: str | None = None,
    patch: str | None = None,
    min_matches: int = 1,
) -> dict[str, Any]:
    """
    Agrega estatísticas de um campeão específico.

    Retorna stats=None se total_matches < min_matches.
    """
    query = (
        db_client.table("match_participants")
        .select(
            "champion_name, team_position, win, kills, deaths, assists, "
            "gold_earned, damage_per_minute, kill_participation, cs_per_minute, "
            "matches(game_version), players(server)"
        )
        .ilike("champion_name", champion)
    )

    if role:
        query = query.eq("team_position", role.upper())

    rows: list[dict] = query.execute().data or []

    if server:
        rows = [r for r in rows if ((r.get("players") or {}).get("server") or "").upper() == server.upper()]
    if patch:
        rows = [r for r in rows if (r.get("matches") or {}).get("game_version") == patch]

    total = len(rows)
    if total < min_matches:
        return {
            "champion": champion,
            "filters": {"role": role, "server": server, "patch": patch},
            "total_matches": total,
            "stats": None,
        }

    wins = sum(1 for r in rows if r.get("win"))

    def avg(field: str) -> float:
        return sum(r.get(field) or 0.0 for r in rows) / total

    return {
        "champion": champion,
        "filters": {"role": role, "server": server, "patch": patch},
        "total_matches": total,
        "stats": {
            "winrate":              round(wins / total * 100, 2),
            "avg_kills":            round(avg("kills"), 2),
            "avg_deaths":           round(avg("deaths"), 2),
            "avg_assists":          round(avg("assists"), 2),
            "avg_gold":             round(avg("gold_earned"), 0),
            "avg_damage_per_minute": round(avg("damage_per_minute"), 1),
            "avg_cs_per_minute":    round(avg("cs_per_minute"), 2),
            "avg_kill_participation": round(avg("kill_participation"), 3),
        },
    }


# ── Builds ────────────────────────────────────────────────────────────────────

def buscar_builds(
    db_client,
    champion: str,
    patch: str | None = None,
    role: str | None = None,
    min_picks: int = 3,
) -> list[dict[str, Any]]:
    """
    Retorna os itens mais frequentes do campeão com Wilson score.

    Filtros opcionais: patch, role.
    Exclui STARTER e CONSUMABLE via join com tabela items.
    Ordenado por wilson_score desc (estimativa conservadora de winrate real).

    Campos retornados: item_id, item_name, patch, role, pick_count, win_count,
                       winrate_pct, wilson_score, category.
    """
    categories = _load_item_categories(db_client)

    query = (
        db_client.table("champion_builds")
        .select("item_id, item_name, patch, role, pick_count, win_count")
        .ilike("champion_name", champion)
    )
    if patch:
        query = query.eq("patch", patch)
    if role:
        query = query.eq("role", role.upper())

    rows: list[dict] = query.execute().data or []

    # Sem filtro de role: agregar por item_id somando picks/wins de todas as roles.
    # Com filtro de role: manter as linhas individuais (já filtradas acima).
    if not role:
        aggregated: dict[int, dict] = {}
        for r in rows:
            iid = r["item_id"]
            if iid not in aggregated:
                aggregated[iid] = {
                    "item_id":   iid,
                    "item_name": r.get("item_name") or f"Item {iid}",
                    "patch":     r.get("patch"),
                    "role":      None,
                    "pick_count": 0,
                    "win_count":  0,
                }
            aggregated[iid]["pick_count"] += r.get("pick_count") or 0
            aggregated[iid]["win_count"]  += r.get("win_count") or 0
        rows = list(aggregated.values())

    result: list[dict[str, Any]] = []
    for r in rows:
        picks = r.get("pick_count") or 0
        wins = r.get("win_count") or 0
        if picks < min_picks:
            continue
        item_id = r["item_id"]
        category = categories.get(item_id)
        if category in _EXCLUDED_CATEGORIES:
            continue
        result.append({
            "item_id":      item_id,
            "item_name":    r.get("item_name") or f"Item {item_id}",
            "patch":        r.get("patch"),
            "role":         r.get("role"),
            "pick_count":   picks,
            "win_count":    wins,
            "winrate_pct":  round(wins / picks * 100, 1) if picks else 0.0,
            "wilson_score": round(_wilson_lower(picks, wins) * 100, 1),
            "category":     category,
        })

    result.sort(key=lambda x: x["wilson_score"], reverse=True)
    return result


# ── Matchups ──────────────────────────────────────────────────────────────────

def buscar_matchups(
    db_client,
    champion: str,
    role: str | None = None,
    patch: str | None = None,
    min_matches: int = 3,
) -> list[dict[str, Any]]:
    """
    Winrate do campeão contra cada oponente na mesma lane.

    Estratégia (2 queries + agregação Python):
      1. Busca todos os match_ids onde o campeão jogou (com team_id e team_position).
      2. Busca todos os participantes nesses matches.
      3. Cruza: oponente = mesmo match_id, mesma posição, time diferente.
    """
    # ── Passo 1: aparições do campeão ────────────────────────────
    q1 = (
        db_client.table("match_participants")
        .select("match_id, team_id, team_position, win, matches(game_version)")
        .ilike("champion_name", champion)
    )
    if role:
        q1 = q1.eq("team_position", role.upper())

    champ_rows: list[dict] = q1.execute().data or []

    if patch:
        champ_rows = [r for r in champ_rows if (r.get("matches") or {}).get("game_version") == patch]

    if not champ_rows:
        return []

    # Limite de 200 para evitar URLs enormes no IN do PostgREST
    champ_rows = champ_rows[:200]
    champ_by_match = {
        r["match_id"]: {"team_id": r["team_id"], "position": r["team_position"], "win": r["win"]}
        for r in champ_rows
    }
    match_ids = list(champ_by_match.keys())

    # ── Passo 2: todos os participantes nesses matches ────────────
    all_rows: list[dict] = (
        db_client.table("match_participants")
        .select("match_id, champion_name, team_id, team_position")
        .in_("match_id", match_ids)
        .execute()
        .data or []
    )

    # ── Passo 3: agregação ────────────────────────────────────────
    buckets: dict[str, dict] = defaultdict(lambda: {"games": 0, "champ_wins": 0})

    for row in all_rows:
        mid = row.get("match_id")
        champ = champ_by_match.get(mid)
        if not champ:
            continue
        if row.get("team_id") == champ["team_id"]:  # mesmo time → aliado, não oponente
            continue
        if role and row.get("team_position") != champ["position"]:  # posição diferente
            continue
        opp = row.get("champion_name")
        if not opp:
            continue
        buckets[opp]["games"] += 1
        if champ["win"]:
            buckets[opp]["champ_wins"] += 1

    # Winrate geral do campeão (para normalização)
    total_champ_games = len(champ_rows)
    total_champ_wins = sum(1 for r in champ_rows if r.get("win"))
    champ_overall_wr = round(total_champ_wins / total_champ_games * 100, 2) if total_champ_games else 50.0

    result = [
        {
            "opponent": name,
            "games": d["games"],
            "winrate": round(d["champ_wins"] / d["games"] * 100, 2),
            "winrate_diff": round(d["champ_wins"] / d["games"] * 100 - champ_overall_wr, 2),
        }
        for name, d in buckets.items()
        if d["games"] >= min_matches
    ]
    result.sort(key=lambda x: x["games"], reverse=True)
    return result


# ── Synergies ─────────────────────────────────────────────────────────────────

def buscar_synergies(
    db_client,
    champion: str,
    role: str | None = None,
    patch: str | None = None,
    min_matches: int = 3,
) -> list[dict[str, Any]]:
    """
    Winrate do campeão quando jogando ao lado de cada aliado.

    Mesma estratégia de 2 queries do buscar_matchups,
    mas filtra team_id == mesmo time e exclui o próprio campeão.
    """
    # ── Passo 1 ───────────────────────────────────────────────────
    q1 = (
        db_client.table("match_participants")
        .select("match_id, team_id, team_position, win, matches(game_version)")
        .ilike("champion_name", champion)
    )
    if role:
        q1 = q1.eq("team_position", role.upper())

    champ_rows: list[dict] = q1.execute().data or []

    if patch:
        champ_rows = [r for r in champ_rows if (r.get("matches") or {}).get("game_version") == patch]

    if not champ_rows:
        return []

    champ_rows = champ_rows[:200]
    champ_by_match = {
        r["match_id"]: {"team_id": r["team_id"], "win": r["win"]}
        for r in champ_rows
    }
    match_ids = list(champ_by_match.keys())

    # ── Passo 2 ───────────────────────────────────────────────────
    all_rows: list[dict] = (
        db_client.table("match_participants")
        .select("match_id, champion_name, team_id")
        .in_("match_id", match_ids)
        .execute()
        .data or []
    )

    # ── Passo 3 ───────────────────────────────────────────────────
    buckets: dict[str, dict] = defaultdict(lambda: {"games": 0, "champ_wins": 0})

    for row in all_rows:
        mid = row.get("match_id")
        champ = champ_by_match.get(mid)
        if not champ:
            continue
        if row.get("team_id") != champ["team_id"]:  # time diferente → oponente
            continue
        ally = row.get("champion_name")
        if not ally or ally.lower() == champion.lower():  # exclui o próprio campeão
            continue
        buckets[ally]["games"] += 1
        if champ["win"]:
            buckets[ally]["champ_wins"] += 1

    result = [
        {
            "ally": name,
            "games": d["games"],
            "winrate": round(d["champ_wins"] / d["games"] * 100, 2),
        }
        for name, d in buckets.items()
        if d["games"] >= min_matches
    ]
    result.sort(key=lambda x: x["games"], reverse=True)
    return result
