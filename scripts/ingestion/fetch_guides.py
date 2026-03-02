import os
import json
import gzip
import boto3
import time
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
# ... (Mantenha as funções get_r2_client e compress_and_upload idênticas ao código anterior) ...

def get_elite_guide_urls(champion_name, page):
    """Busca no Mobafire apenas guias do High Elo para o campeão."""
    champ_query = champion_name.replace(" ", "+")
    # A URL mágica: Filtra por campeão e força apenas os 3 elos mais altos
    search_url = f"https://www.mobafire.com/league-of-legends/browse?champion={champ_query}&tier=Master%2CGrandmaster%2CChallenger"

    print(f"🔎 Procurando Guias de Elite para {champion_name}...")
    page.goto(search_url, wait_until="networkidle")
    time.sleep(2)

    soup = BeautifulSoup(page.content(), 'html.parser')
    elite_urls = []

    # Procura todos os links que levam para uma 'build' (guia)
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        if '/build/' in href and 'league-of-legends' in href:
            full_url = f"https://www.mobafire.com{href}" if href.startswith('/') else href
            if full_url not in elite_urls:
                elite_urls.append(full_url)
                # Pegamos apenas os 2 melhores guias por campeão para não estourar o limite
                if len(elite_urls) >= 2:
                    break

    return elite_urls

def scrape_mobafire_guide(url, champion_name, s3_client, page):
    """Extrai o texto do guia."""
    print(f"  -> 📖 Infiltrando: {url}")
    try:
        page.goto(url, wait_until="networkidle")
        time.sleep(3) # Pausa humana para o Cloudflare não surtar

        soup = BeautifulSoup(page.content(), 'html.parser')

        title_tag = soup.find('h1', class_='guide-main-title')
        guide_title = title_tag.text.strip() if title_tag else "Sem Título"

        author_tag = soup.find('span', class_='author-name')
        author_name = author_tag.text.strip() if author_tag else "Desconhecido"

        chapters_data = []
        for chap in soup.find_all('div', class_='guide-chapter'):
            chap_title_tag = chap.find('h3')
            chap_title = chap_title_tag.text.strip() if chap_title_tag else "Capítulo"

            chap_text = chap.get_text(separator=' ', strip=True)
            if chap_title in chap_text:
                chap_text = chap_text.replace(chap_title, "", 1).strip()

            # Filtro anti-lixo: só salva se o capítulo tiver texto mesmo
            if len(chap_text) > 50:
                chapters_data.append({"title": chap_title, "content": chap_text})

        if chapters_data:
            print(f"    ✅ Sucesso! {len(chapters_data)} capítulos capturados do {author_name}.")
            guide_package = {
                "champion": champion_name,
                "url": url,
                "title": guide_title,
                "author": author_name,
                "tier_filter": "Master+",
                "chapters": chapters_data
            }

            file_name = f"{champion_name.lower().replace(' ', '_')}_{author_name.lower()}"
            compress_and_upload(guide_package, "guides", file_name, s3_client)
        else:
            print("    ⚠️ Guia vazio ou protegido. Ignorando.")

    except Exception as e:
        print(f"    ❌ Falha: {e}")

def run_wisdom_ingestion():
    s3 = get_r2_client()

    # Uma lista pequena para teste. Depois você pode colocar todos os 160+ campeões!
    champions_to_scrape = ["Lee Sin", "Nidalee", "Elise"]

    with sync_playwright() as p:
        # headless=False abre o navegador na sua frente. Ótimo para debugar!
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        for champ in champions_to_scrape:
            urls = get_elite_guide_urls(champ, page)
            if not urls:
                print(f"🤷‍♀️ Nenhum guia Elite encontrado para {champ}.")
                continue

            for url in urls:
                scrape_mobafire_guide(url, champ, s3, page)
                time.sleep(5) # Respira entre um guia e outro

        browser.close()

if __name__ == "__main__":
    run_wisdom_ingestion()
