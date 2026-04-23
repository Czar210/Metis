"""
item_service.py — Agregações de itens a partir de match_participants.

A partir de p-0.9.8.1, o catálogo (nome, gold, tags, categoria, tendência)
vem da tabela `items` no Supabase — não mais do JSON estático em runtime.
O JSON continua sendo fonte pro script `sync_items.py` que popula a tabela.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any


def _load_items_catalog(db_client) -> dict[int, dict[str, Any]]:
    """Carrega o catálogo completo de itens da tabela `items` do Supabase.

    Retorna dict {item_id: {name, gold_total, tags, category, trend}}.
    Cai pra dict vazio se a tabela estiver vazia / inacessível — o caller
    deve lidar com `.get(item_id)` retornando None.
    """
    rows = (
        db_client.table("items")
        .select("item_id, name, gold_total, tags, category, trend")
        .execute()
        .data
        or []
    )
    return {
        int(r["item_id"]): {
            "name": r.get("name") or f"Item {r['item_id']}",
            "gold_total": r.get("gold_total") or 0,
            "tags": r.get("tags") or [],
            "category": r.get("category"),
            "trend": r.get("trend"),
        }
        for r in rows
    }


def buscar_item_ranking(
    db_client,
    patch: str | None = None,
    role: str | None = None,
    min_picks: int = 5,
) -> list[dict[str, Any]]:
    """Ranking global de itens por popularidade com winrate + metadados.

    Agrega de `match_participants.items` (JSONB array de 7 slots). Ignora
    item_id 0 (slot vazio) e trinkets (slot 6).

    Cada linha do resultado inclui:
      - item_id, item_name, picks, wins, winrate
      - gold_cost  (int, 0 se desconhecido)
      - tags       (list[str])
      - category   (str | None — curadoria manual; None enquanto não populado)
      - trend      (str | None — 'up' | 'down' | 'flat'; None enquanto não calculado)
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

    # Agregar: item_id → {picks, wins}
    buckets: dict[int, dict[str, int]] = defaultdict(lambda: {"picks": 0, "wins": 0})
    for row in rows:
        items = row.get("items")
        if not items or not isinstance(items, list):
            continue
        win = row.get("win", False)
        for item_id in items[:6]:  # slot 6 = trinket
            if not item_id or item_id == 0:
                continue
            buckets[item_id]["picks"] += 1
            if win:
                buckets[item_id]["wins"] += 1

    catalog = _load_items_catalog(db_client)

    result: list[dict[str, Any]] = []
    for item_id, d in buckets.items():
        if d["picks"] < min_picks:
            continue
        meta = catalog.get(item_id, {})
        result.append({
            "item_id": item_id,
            "item_name": meta.get("name") or f"Item {item_id}",
            "picks": d["picks"],
            "wins": d["wins"],
            "winrate": round(d["wins"] / d["picks"] * 100, 1),
            "gold_cost": meta.get("gold_total") or 0,
            "tags": meta.get("tags") or [],
            "category": meta.get("category"),
            "trend": meta.get("trend"),
        })

    result.sort(key=lambda x: x["picks"], reverse=True)
    return result
