"""
fetch_patch_notes.py - Scraper de patch notes do LoL Wiki

Extrai mudancas de campeoes e itens do patch mais recente e salva no R2
como JSON comprimido para posterior vetorizacao.

Uso:
    python -m scripts.ingestion.fetch_patch_notes
    python -m scripts.ingestion.fetch_patch_notes --patch 16.7
"""

import gzip
import json
import logging
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from scripts.utils.r2_storage import get_r2_client

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BUCKET_NAME  = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
PATCH_PREFIX = "patch_notes/"
WIKI_BASE    = "https://leagueoflegends.fandom.com"

# Tipos de mudanca reconhecidos no wiki
CHANGE_TYPE_MAP = {
    "buffed":    "buff",
    "nerfed":    "nerf",
    "adjusted":  "adjustment",
    "reworked":  "rework",
    "new":       "new",
    "removed":   "removed",
}


def get_latest_patch() -> str:
    versions = requests.get(
        "https://ddragon.leagueoflegends.com/api/versions.json", timeout=10
    ).json()
    raw = versions[0]
    parts = raw.split(".")
    return f"{parts[0]}.{parts[1]}"


def get_patch_wiki_url(patch: str) -> str:
    major, minor = patch.split(".")
    return f"{WIKI_BASE}/wiki/V{major}.{minor}"


def fetch_html(url: str) -> BeautifulSoup | None:
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; MetisBot/1.0)"}
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        logging.warning("Falha ao buscar %s: %s", url, e)
        return None


def _clean(text: str) -> str:
    return " ".join(text.split()).strip()


def _detect_change_type(text: str) -> str:
    lower = text.lower()
    for keyword, ctype in CHANGE_TYPE_MAP.items():
        if keyword in lower:
            return ctype
    return "adjustment"


def _parse_stat_changes(block) -> list[dict]:
    """
    Extrai linhas de mudanca de stat de um bloco HTML do wiki.
    Retorna lista de {change_type, description, content}.
    """
    changes = []
    current_type = "adjustment"

    for tag in block.find_all(["dt", "dd", "li", "p"]):
        text = _clean(tag.get_text(separator=" "))
        if not text or len(text) < 5:
            continue

        # dt = cabecalho do tipo de mudanca (Buffed / Nerfed / etc.)
        if tag.name == "dt":
            current_type = _detect_change_type(text)
            continue

        # Linha com seta de valor (55 -> 60 ou 55 => 60)
        has_values = bool(re.search(r"\d+\.?\d*\s*[=-]>?\s*\d+\.?\d*", text))

        if has_values or len(text) > 20:
            changes.append({
                "change_type": current_type,
                "description": text[:120],
                "content":     text,
            })

    return changes


def parse_patch_page(soup: BeautifulSoup, patch: str) -> list[dict]:
    """
    Parseia a pagina de patch do wiki e retorna lista de registros prontos
    para salvar, com campos: patch_version, entity_type, entity_name,
    change_type, description, content.
    """
    records = []

    # Secoes do wiki: Champions, Items, Runes, etc.
    for section in soup.find_all("h2"):
        section_title = _clean(section.get_text())
        if not section_title:
            continue

        if "champion" in section_title.lower():
            entity_type = "champion"
        elif "item" in section_title.lower():
            entity_type = "item"
        elif "rune" in section_title.lower():
            entity_type = "rune"
        elif "system" in section_title.lower() or "objective" in section_title.lower():
            entity_type = "system"
        else:
            continue

        # Percorre irmaos do h2 ate o proximo h2
        sibling = section.find_next_sibling()
        current_entity = None

        while sibling and sibling.name != "h2":
            # h3 = nome do campeao/item
            if sibling.name == "h3":
                current_entity = _clean(sibling.get_text())

            elif sibling.name in ("dl", "ul", "div") and current_entity:
                changes = _parse_stat_changes(sibling)
                for ch in changes:
                    records.append({
                        "patch_version": patch,
                        "entity_type":   entity_type,
                        "entity_name":   current_entity,
                        "change_type":   ch["change_type"],
                        "description":   ch["description"],
                        "content":       ch["content"],
                    })

            sibling = sibling.find_next_sibling()

    return records


def patch_already_scraped(s3_client, patch: str) -> bool:
    key = f"{PATCH_PREFIX}{patch}.json.gz"
    try:
        s3_client.head_object(Bucket=BUCKET_NAME, Key=key)
        return True
    except Exception:
        return False


def upload_patch_notes(s3_client, patch: str, records: list[dict]) -> bool:
    key = f"{PATCH_PREFIX}{patch}.json.gz"
    try:
        payload = json.dumps(records, ensure_ascii=False).encode("utf-8")
        compressed = gzip.compress(payload)
        s3_client.put_object(Bucket=BUCKET_NAME, Key=key, Body=compressed)
        logging.info("Patch notes %s salvo no R2: %d registros", patch, len(records))
        return True
    except Exception as e:
        logging.error("Falha ao salvar patch notes no R2: %s", e)
        return False


def run(patch: str | None = None) -> None:
    s3 = get_r2_client()
    if not s3:
        raise RuntimeError("R2 client nao inicializado.")

    if not patch:
        patch = get_latest_patch()

    logging.info("Processando patch notes: %s", patch)

    if patch_already_scraped(s3, patch):
        logging.info("Patch %s ja foi scrapeado. Nada a fazer.", patch)
        return

    url = get_patch_wiki_url(patch)
    logging.info("URL: %s", url)

    soup = fetch_html(url)
    if not soup:
        logging.error("Nao foi possivel carregar a pagina do patch %s", patch)
        return

    records = parse_patch_page(soup, patch)
    logging.info("Registros extraidos: %d", len(records))

    if not records:
        logging.warning("Nenhum registro extraido. Verifique o HTML do wiki.")
        return

    champions = {r["entity_name"] for r in records if r["entity_type"] == "champion"}
    items     = {r["entity_name"] for r in records if r["entity_type"] == "item"}
    runes     = {r["entity_name"] for r in records if r["entity_type"] == "rune"}

    logging.info(
        "Resumo: %d campeoes | %d itens | %d runas",
        len(champions), len(items), len(runes),
    )

    upload_patch_notes(s3, patch, records)


if __name__ == "__main__":
    patch_arg = None
    if "--patch" in sys.argv:
        idx = sys.argv.index("--patch")
        patch_arg = sys.argv[idx + 1]
    run(patch_arg)
