"""
stats_service.py — Agregações estatísticas sobre match_participants.

Fluxo:
  Supabase (match_participants + matches + players) → filtros → agregação Python → dict de resposta

Nota sobre o filtro ?elo=:
  Elo/tier (Challenger, Diamond, etc.) não está armazenado por partida no schema atual.
  O parâmetro é aceito mas ignorado — será implementado quando a tabela player_ranks existir.
"""

from __future__ import annotations
from typing import Any


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
