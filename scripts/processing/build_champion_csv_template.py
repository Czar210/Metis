"""
build_champion_csv_template.py  monta o CSV template pra classificao manual
dos campees por Csar (Fase 4 do plano v0.9.0).

L o championFull.json do DDragon e gera:
    data/champion_classification.csv

Colunas preenchidas automaticamente:
    champion_name    chave da Riot (ex: "MonkeyKing", no "Wukong")
    display_name     nome exibido em pt-BR (ex: "Vayne")
    title            alcunha (ex: "A Caadora Noturna")
    ddragon_tags     tags oficiais separadas por '|' (ex: "Marksman|Assassin")
    short_blurb      descrio curta (200 chars, pt-BR)

Colunas em branco, Csar preenche  mo:
    primary_class       uma das 10 classes da nossa taxonomia
    secondary_classes   extras, separados por '|' (opcional)
    notes               observaes livres (opcional)

Uso:
    python -m scripts.processing.build_champion_csv_template
"""

from __future__ import annotations

import csv
import json
import logging
import sys
from pathlib import Path

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("build_champion_csv")

VERSION = "16.7.1"
URL = f"https://ddragon.leagueoflegends.com/cdn/{VERSION}/data/pt_BR/championFull.json"
OUTPUT = Path(__file__).parents[2] / "data" / "champion_classification.csv"

FIELDS = [
    "champion_name",
    "display_name",
    "title",
    "ddragon_tags",
    "short_blurb",
    # Preenchimento manual abaixo:
    "primary_class",
    "secondary_classes",
    "notes",
]


def fetch_champions() -> dict:
    logger.info(f"GET {URL}")
    with httpx.Client(timeout=30) as client:
        r = client.get(URL)
        r.raise_for_status()
    return r.json()["data"]


def clean_blurb(text: str) -> str:
    """Remove quebras de linha e corta em 200 chars pra caber bem no CSV."""
    if not text:
        return ""
    flat = " ".join(text.split())
    return flat[:200] + ("" if len(flat) > 200 else "")


def main() -> int:
    try:
        data = fetch_champions()
    except Exception as err:
        logger.error(f"Falha ao buscar DDragon: {err}")
        return 1

    logger.info(f"{len(data)} campees recebidos da verso {VERSION}")

    rows = []
    for name, ch in sorted(data.items(), key=lambda kv: kv[1].get("name", kv[0]).lower()):
        rows.append({
            "champion_name":     name,
            "display_name":      ch.get("name", name),
            "title":             ch.get("title", ""),
            "ddragon_tags":      "|".join(ch.get("tags", [])),
            "short_blurb":       clean_blurb(ch.get("blurb", "")),
            "primary_class":     "",
            "secondary_classes": "",
            "notes":             "",
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    logger.info(f" Escrito {len(rows)} rows em {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
