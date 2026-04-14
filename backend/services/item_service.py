"""
item_service.py — Agregações de itens a partir de match_participants.

Calcula winrate e popularidade de cada item considerando os dados brutos.
"""

from __future__ import annotations
from collections import defaultdict
from typing import Any
import json
import os


def _load_item_dict() -> dict[int, str]:
    """Carrega o dicionário de itens do JSON estático."""
    path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "static", "item.json")
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        data = raw.get("data", raw)
        return {int(k): v.get("name", f"Item {k}") for k, v in data.items()}
    except Exception:
        return {}


_item_dict: dict[int, str] | None = None


def _get_item_dict() -> dict[int, str]:
    global _item_dict
    if _item_dict is None:
        _item_dict = _load_item_dict()
    return _item_dict


def buscar_item_ranking(
    db_client,
    patch: str | None = None,
    role: str | None = None,
    min_picks: int = 5,
) -> list[dict[str, Any]]:
    """
    Ranking global de itens por winrate.

    Agrega diretamente de match_participants.items (JSONB array de 7 slots).
    Ignora item_id 0 (slot vazio) e trinkets (slot 6).
    """
    query = (
        db_client.table("match_participants")
        .select("items, win, team_position, matches(game_version)")
    )

    if role:
        query = query.eq("team_position", role.upper())

    rows: list[dict] = query.execute().data or []

    if patch:
        rows = [r for r in rows if (r.get("matches") or {}).get("game_version") == patch]

    item_dict = _get_item_dict()

    # Agregar: item_id → {picks, wins}
    buckets: dict[int, dict[str, int]] = defaultdict(lambda: {"picks": 0, "wins": 0})

    for row in rows:
        items = row.get("items")
        if not items or not isinstance(items, list):
            continue
        win = row.get("win", False)

        # Slots 0-5 são itens (slot 6 = trinket, ignorado)
        for item_id in items[:6]:
            if not item_id or item_id == 0:
                continue
            buckets[item_id]["picks"] += 1
            if win:
                buckets[item_id]["wins"] += 1

    result: list[dict[str, Any]] = []
    for item_id, d in buckets.items():
        if d["picks"] < min_picks:
            continue
        result.append({
            "item_id": item_id,
            "item_name": item_dict.get(item_id, f"Item {item_id}"),
            "picks": d["picks"],
            "wins": d["wins"],
            "winrate": round(d["wins"] / d["picks"] * 100, 1),
        })

    result.sort(key=lambda x: x["picks"], reverse=True)
    return result
