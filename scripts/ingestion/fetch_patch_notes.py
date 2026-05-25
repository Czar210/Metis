"""
fetch_patch_notes.py - Scraper de patch notes oficiais da Riot

Extrai mudancas de campeoes e itens da pagina oficial de patch notes
usando Playwright (mesma abordagem do Mobafire) e salva no R2.

Uso:
    python -m scripts.ingestion.fetch_patch_notes
    python -m scripts.ingestion.fetch_patch_notes --patch 16.10
"""

import datetime
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
from playwright.sync_api import sync_playwright

from scripts.utils.r2_storage import get_r2_client

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BUCKET_NAME  = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
PATCH_PREFIX = "patch_notes/"

CHANGE_TYPE_MAP = {
    "buff":       "buff",
    "nerf":       "nerf",
    "adjustment": "adjustment",
    "rework":     "rework",
    "new":        "new",
    "removed":    "removed",
}


def get_latest_patch() -> str:
    versions = requests.get(
        "https://ddragon.leagueoflegends.com/api/versions.json", timeout=10
    ).json()
    raw = versions[0]
    parts = raw.split(".")
    return f"{parts[0]}.{parts[1]}"


def find_and_fetch_patch(patch: str) -> tuple[str | None, str | None]:
    """
    Descobre a URL da patch notes via listagem JS-renderizada e retorna (url, html).
    Tudo em uma unica sessao Playwright para evitar overhead duplo.
    """
    # Data Dragon retorna versao do cliente (ex: "16.10"), mas o site usa
    # ano de 2 digitos (ex: "26.10" para 2026). O minor bate entre os dois.
    _major, minor = patch.split(".")
    year_2d      = str(datetime.date.today().year)[-2:]
    pattern      = re.compile(rf"patch-{year_2d}-{minor}-notes", re.IGNORECASE)
    listing_url  = "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                locale="en-US",
            )
            page = context.new_page()

            # 1. Carrega a listagem de patch notes
            page.goto(listing_url, wait_until="networkidle", timeout=60000)
            time.sleep(3)

            # 2. Extrai todos os hrefs e filtra pelo padrao ano+minor
            hrefs = page.eval_on_selector_all(
                "a[href]", "els => els.map(e => e.href)"
            )

            patch_url = None
            for href in hrefs:
                if pattern.search(href):
                    patch_url = href
                    logging.info("URL encontrada: %s", patch_url)
                    break

            if not patch_url:
                logging.error("Patch %s nao encontrado na listagem de patch notes.", patch)
                browser.close()
                return None, None

            # 3. Navega para a pagina real de patch notes
            page.goto(patch_url, wait_until="networkidle", timeout=60000)
            time.sleep(4)
            html = page.content()
            browser.close()
            return patch_url, html

    except Exception as e:
        logging.error("Playwright falhou: %s", e)
        return None, None


def _clean(text: str) -> str:
    return " ".join(text.split()).strip()


def _detect_change_type(header_text: str) -> str:
    lower = header_text.lower()
    for keyword, ctype in CHANGE_TYPE_MAP.items():
        if keyword in lower:
            return ctype
    return "adjustment"


def _parse_change_lines(block_text: str) -> list[str]:
    """Extrai linhas com valores numericos ou descricoes de mudanca."""
    lines = []
    for line in block_text.split("\n"):
        line = _clean(line)
        if not line or len(line) < 8:
            continue
        has_arrow   = bool(re.search(r"\d+\.?\d*\s*(=>|->|to)\s*\d+\.?\d*", line, re.IGNORECASE))
        has_percent = "%" in line and any(c.isdigit() for c in line)
        has_seconds = bool(re.search(r"\d+\.?\d*\s*s(ec)?", line, re.IGNORECASE))
        if has_arrow or has_percent or has_seconds or len(line) > 30:
            lines.append(line)
    return lines


_ABILITY_RE = re.compile(r"^[QWERP] -", re.IGNORECASE)
_CHANGE_RE  = re.compile(r"⇒|=>")
_NOISE_RE   = re.compile(
    r"opens in a new|opens an external|cookie|privacy notice|esrb|"
    r"riot games|terms of service|™|this website utilizes|"
    r"wrong patch notes|looking for more",
    re.IGNORECASE,
)
_DATE_RE    = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")
_STOP_RE    = re.compile(
    r"hey arena brawlers|hello aramers|related articles|about league of legends",
    re.IGNORECASE,
)
_ITEM_KEYWORDS = frozenset([
    "doran", "greaves", "boots", "bane", "sword", "cloak", "staff", "blade",
    "bow", "shield", "helm", "spear", "touch", "surge", "cyclosword",
    "deathfire", "stormraider", "lich", "voltaic", "immortal path",
])


def _classify_entity(name: str, has_abilities: bool) -> str:
    low = name.lower()
    if any(kw in low for kw in _ITEM_KEYWORDS):
        return "item"
    return "champion" if has_abilities else "champion"


def parse_patch_html(html: str, patch: str) -> list[dict]:
    """
    Parseia o HTML da pagina oficial de patch notes da Riot (2026+).

    Estrutura real da pagina:
    - Nenhum header de secao explicito — campeoes aparecem diretamente
    - Mudancas de stat: "Nome do stat\\n: valor_antigo ⇒\\nvalor_novo" (3 linhas)
    - Habilidades: "Q - Nome", "W - Nome", etc.
    - Secoes Arena/ARAM aparecem depois e devem ser ignoradas
    """
    soup = BeautifulSoup(html, "html.parser")
    records = []

    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    raw_lines = [l.strip() for l in soup.get_text(separator="\n").split("\n") if l.strip()]

    # Corta antes de Arena / ARAM / secoes nao-SR
    cut: list[str] = []
    for line in raw_lines:
        if _STOP_RE.search(line):
            break
        cut.append(line)

    # Une mudancas de 3 linhas em 1:
    # "Stat Name" + ": old ⇒" + "new"  →  "Stat Name: old ⇒ new"
    joined: list[str] = []
    for line in cut:
        if line.startswith(":") and joined:
            joined[-1] += line                     # "Stat Name: old ⇒" ou "Stat Name: old ⇒ new"
        elif joined and joined[-1].rstrip().endswith("⇒"):
            joined[-1] += " " + line              # "Stat Name: old ⇒ new"
        else:
            joined.append(line)

    current_entity   = None
    current_ability  = None
    change_lines:  list[str] = []
    has_abilities  = False

    def flush() -> None:
        if current_entity and change_lines:
            etype   = _classify_entity(current_entity, has_abilities)
            content = " | ".join(change_lines)
            records.append({
                "patch_version": patch,
                "entity_type":   etype,
                "entity_name":   current_entity,
                "change_type":   "adjustment",
                "description":   change_lines[0][:120],
                "content":       content,
            })

    def _is_entity_candidate(line: str) -> bool:
        if len(line) < 2 or len(line) > 65:
            return False
        if not line[0].isupper():
            return False
        if _CHANGE_RE.search(line):
            return False
        if _ABILITY_RE.match(line):
            return False
        if line.startswith((":", "NEW", "[", "Update:")):
            return False
        if ":" in line:
            return False
        if line in {"Base Stats", "Base Stat", "BUGFIX"}:
            return False
        if _NOISE_RE.search(line) or _DATE_RE.match(line):
            return False
        return True

    i = 0
    while i < len(joined):
        line = joined[i]

        # Habilidade (Q/W/E/R/P) ou "Base Stats"
        if _ABILITY_RE.match(line) or line == "Base Stats":
            current_ability = line
            if _ABILITY_RE.match(line):
                has_abilities = True
            i += 1
            continue

        # Linha de mudanca de stat
        if _CHANGE_RE.search(line):
            if current_entity:
                prefix = f"[{current_ability}] " if current_ability else ""
                change_lines.append(f"{prefix}{line}")
            i += 1
            continue

        # Candidato a entidade — confirma com lookahead de ate 20 linhas
        if _is_entity_candidate(line):
            has_upcoming = any(
                _CHANGE_RE.search(joined[j])
                for j in range(i + 1, min(i + 20, len(joined)))
            )
            if has_upcoming:
                flush()
                current_entity  = line
                current_ability = None
                change_lines    = []
                has_abilities   = False
                i += 1
                continue

        i += 1

    flush()
    return records


def fetch_with_playwright(url: str) -> str | None:
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                locale="en-US",
            )
            page = context.new_page()
            page.goto(url, wait_until="networkidle", timeout=60000)
            time.sleep(4)
            html = page.content()
            browser.close()
            return html
    except Exception as e:
        logging.error("Playwright falhou: %s", e)
        return None


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
        payload    = json.dumps(records, ensure_ascii=False).encode("utf-8")
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

    url, html = find_and_fetch_patch(patch)
    logging.info("URL: %s", url)

    if not html:
        logging.error("Nao foi possivel carregar a pagina do patch %s", patch)
        return

    records = parse_patch_html(html, patch)
    logging.info("Registros extraidos: %d", len(records))

    if not records:
        logging.warning("Nenhum registro extraido. Verifique o HTML da pagina.")
        return

    champions = {r["entity_name"] for r in records if r["entity_type"] == "champion"}
    items     = {r["entity_name"] for r in records if r["entity_type"] == "item"}
    runes     = {r["entity_name"] for r in records if r["entity_type"] == "rune"}

    logging.info(
        "Resumo: %d campeoes | %d itens | %d runas",
        len(champions), len(items), len(runes),
    )

    upload_patch_notes(s3, patch, records)


def debug_dump(patch: str | None = None) -> None:
    """Salva o HTML bruto e o texto extraido para inspecao local."""
    if not patch:
        patch = get_latest_patch()
    url, html = find_and_fetch_patch(patch)
    logging.info("Debug dump para patch %s — URL: %s", patch, url)
    if not html:
        logging.error("Falha ao buscar HTML")
        return
    with open(f"patch_{patch}_raw.html", "w", encoding="utf-8") as f:
        f.write(html)
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    with open(f"patch_{patch}_text.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    logging.info("Salvo: patch_%s_raw.html (%d bytes) e patch_%s_text.txt (%d linhas)",
                 patch, len(html), patch, len(lines))


if __name__ == "__main__":
    patch_arg  = None
    debug      = "--debug"      in sys.argv
    parse_only = "--parse-only" in sys.argv
    if "--patch" in sys.argv:
        idx       = sys.argv.index("--patch")
        patch_arg = sys.argv[idx + 1]
    if debug:
        debug_dump(patch_arg)
    elif parse_only:
        _patch = patch_arg or get_latest_patch()
        _path  = f"patch_{_patch}_raw.html"
        with open(_path, encoding="utf-8") as f:
            _html = f.read()
        _records = parse_patch_html(_html, _patch)
        logging.info("Registros: %d", len(_records))
        champs = {r["entity_name"] for r in _records if r["entity_type"] == "champion"}
        items  = {r["entity_name"] for r in _records if r["entity_type"] == "item"}
        logging.info("Campeoes: %s", sorted(champs))
        logging.info("Itens: %s", sorted(items))
        for r in _records[:3]:
            sys.stdout.buffer.write(
                f"\n---\n[{r['entity_type']}] {r['entity_name']}\n{r['content'][:300]}\n".encode("utf-8")
            )
    else:
        run(patch_arg)
