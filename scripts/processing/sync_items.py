"""
sync_items.py  Popula a tabela `items` a partir do Data Dragon.

L o item.json esttico em data/static/ e faz upsert em lote no Supabase.
As colunas proprietrias (`category`, `trend`) NO so tocadas por este
script  ficam sob curadoria manual do time ou de jobs futuros.

Uso:
    python -m scripts.processing.sync_items
    python -m scripts.processing.sync_items --source data/static/item.json
    python -m scripts.processing.sync_items --batch-size 100

Requer SUPABASE_URL e SUPABASE_KEY (service_role) no ambiente.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sync_items")

DEFAULT_SOURCE = Path(__file__).parents[2] / "data" / "static" / "item.json"
DEFAULT_BATCH = 200


def _classify_tier(item_id: int, payload: dict, gold: dict) -> str:
    """Classifica um item DDragon em uma categoria para recomendação.

    Categorias:
      CONSUMABLE — poções, elixires
      STARTER    — itens de Doran, jungle starters, support starters (GoldPer)
      BOOTS      — qualquer tipo de bota
      COMPONENT  — peça intermediária (tem 'into', ou seja, vira outro item)
      FULL       — item completo (tem 'from' ou gold >= 2000)
    """
    tags = payload.get("tags") or []
    has_into = bool(payload.get("into"))
    has_from = bool(payload.get("from"))
    gold_total = int(gold.get("total") or 0)

    if "Consumable" in tags:
        return "CONSUMABLE"
    # Lane + sem "into" + gold barato = starter real (Doran's, Dark Seal, Cull)
    # "Lane" em itens caros (Atma, gold=2500) ou componentes (Long Sword, has_into) não é starter
    if "Lane" in tags and not has_into and gold_total < 800:
        return "STARTER"
    # Jungle starters (filhotes de jungle pets) não têm from nem into
    if "Jungle" in tags and not has_from and not has_into:
        return "STARTER"
    # Support starters geram gold — threshold evita itens completos com tag GoldPer (Ápice da Tempestade)
    if "GoldPer" in tags and gold_total < 800:
        return "STARTER"
    if "Boots" in tags:
        return "BOOTS"
    if has_into:
        return "COMPONENT"
    if has_from or gold_total >= 2000:
        return "FULL"
    return "COMPONENT"


def _load_items(path: Path) -> list[dict[str, Any]]:
    """L item.json e retorna lista de dicts prontos pra upsert."""
    if not path.exists():
        raise FileNotFoundError(f"item.json no encontrado em {path}")

    with path.open(encoding="utf-8") as f:
        raw = json.load(f)

    data = raw.get("data", {})
    items: list[dict[str, Any]] = []

    for item_id_str, payload in data.items():
        try:
            item_id = int(item_id_str)
        except ValueError:
            continue  # chaves no numricas so rudo

        gold = payload.get("gold") or {}
        items.append({
            "item_id":     item_id,
            "name":        payload.get("name") or f"Item {item_id}",
            "gold_total":  int(gold.get("total") or 0),
            "gold_base":   int(gold.get("base") or 0),
            "gold_sell":   int(gold.get("sell") or 0),
            "purchasable": bool(gold.get("purchasable", True)),
            "tags":        payload.get("tags") or [],
            "plaintext":   payload.get("plaintext") or None,
            "category":    _classify_tier(item_id, payload, gold),
        })

    return items


def sync(source: Path, batch_size: int) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY so obrigatrios no .env")

    items = _load_items(source)
    logger.info(f"Carregados {len(items)} itens de {source}")

    if not items:
        logger.warning("Nenhum item encontrado  saindo")
        return

    db = create_client(url, key)

    # Upsert em batches. `on_conflict='item_id'` garante idempotncia:
    # rodar 2x no duplica, s atualiza gold/tags/etc.
    # IMPORTANTE: no enviamos `category` nem `trend`, preservando curadoria
    # existente quando o registro j existe.
    total = 0
    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]
        db.table("items").upsert(batch, on_conflict="item_id").execute()
        total += len(batch)
        logger.info(f"  upsert {total}/{len(items)}")

    logger.info(f" Sincronizados {total} itens")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincroniza a tabela items com o Data Dragon")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Caminho pro item.json")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH, help="Tamanho do batch de upsert")
    args = parser.parse_args()

    try:
        sync(args.source, args.batch_size)
    except Exception as err:  # noqa: BLE001
        logger.error(f"Falha na sincronizao: {err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
