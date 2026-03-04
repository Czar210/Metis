import os
import time
import json
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

from scripts.ingestion.fetch_matches import (
    get_r2_client,
    compress_and_upload
)

load_dotenv()
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

def get_champion_slug(champion_name):
    slug = champion_name.lower().replace(" ", "-").replace("'", "").replace(".", "")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug

def get_elite_guide_urls(champion_name, page):
    slug = get_champion_slug(champion_name)
    print(f"\n🔎 Acessando o Diretório para: {champion_name}...")

    champions_dir_url = "https://www.mobafire.com/league-of-legends/champions"
    page.goto(champions_dir_url, wait_until="domcontentloaded", timeout=60000)
    time.sleep(2)

    soup = BeautifulSoup(page.content(), 'html.parser')
    champ_link = None

    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        if '/champion/' in href and slug in href.lower():
            champ_link = f"https://www.mobafire.com{href}" if href.startswith('/') else href
            break

    if not champ_link:
        print(f"❌ Não foi possível encontrar a página matriz do campeão {champion_name}.")
        return []

    print(f"✅ Página Matriz Encontrada: {champ_link}")

    page.goto(champ_link, wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)

    soup = BeautifulSoup(page.content(), 'html.parser')
    elite_urls = []

    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']

        if '/build/' in href and slug in href.lower():
            link_text = a_tag.get_text(separator=' ', strip=True).lower()
            if 'in-depth' in link_text or 'in depth' in link_text:
                full_url = f"https://www.mobafire.com{href}" if href.startswith('/') else href
                if full_url not in elite_urls:
                    elite_urls.append(full_url)
                    if len(elite_urls) >= 2:
                        break

    return elite_urls

def scrape_mobafire_guide(url, champion_name, s3_client, page):
    """Extrai o texto, salva localmente e PERGUNTA ao usuário antes de prosseguir."""
    print(f"  -> 📖 Infiltrando: {url}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        print("    🖱️ Rolando a página (Buscando o Lazy Loading)...")
        for _ in range(8):
            page.mouse.wheel(0, 1500)
            time.sleep(1.5)

        time.sleep(3)

        soup = BeautifulSoup(page.content(), 'html.parser')

        # --- FASE 0: EXTERMINADOR DE LIXO (Purificação do DOM) ---
        # Antes de procurar o conteúdo, nós DELETAMOS tudo que é inútil do HTML.
        lixos = [
            'footer', 'nav', 'script', 'style', 'iframe', 'noscript',
            '.mf-head', '.mf-footer', '#venatus-ad', '.ad-container',
            '.comment-list', '.guide-comments', '.social-share',
            '.network-bar', '.more-guides'
        ]
        for seletor in lixos:
            for node in soup.select(seletor):
                node.decompose() # Destrói a tag do HTML

        title_tag = soup.find('h1', class_='guide-main-title')
        guide_title = title_tag.text.strip() if title_tag else "Sem Título"

        author_tag = soup.find('span', class_='author-name')
        author_name = author_tag.text.strip() if author_tag else "Desconhecido"

        chapters_data = []

        # --- REDE 1: Anotações Extras ---
        for note in soup.find_all(['div', 'span'], class_=['build-text', 'champ-build__notes', 'matchup-notes', 'mf-redumb-content', 'notes']):
            # Usando \n para manter parágrafos organizados em vez de bloco sólido
            note_text = note.get_text(separator='\n', strip=True)
            if len(note_text) > 40 and not any(note_text in c['content'] for c in chapters_data):
                chapters_data.append({"title": "Anotações do Autor", "content": note_text})

        # --- REDE 2: Capítulos (Suporta o Layout Antigo e o Layout Hiper Moderno) ---
        for chap in soup.find_all(['div', 'section'], class_=['guide-chapter', 'champ-build__section', 'view-guide__section']):
            chap_title_tag = chap.find(['h2', 'h3', 'div'], class_=['champ-build__section__header', 'guide-chapter-title'])
            if not chap_title_tag:
                chap_title_tag = chap.find(['h2', 'h3'])

            chap_title = chap_title_tag.text.strip() if chap_title_tag else "Capítulo"

            text_block = chap.find(['div', 'article'], class_=['bbcode', 'champ-build__section__content', 'guide-chapter-content'])
            if text_block:
                chap_text = text_block.get_text(separator='\n', strip=True)
            else:
                chap_text = chap.get_text(separator='\n', strip=True)
                if chap_title in chap_text:
                    chap_text = chap_text.replace(chap_title, "", 1).strip()

            if len(chap_text) > 50:
                if not any(chap_text[:100] in c['content'] for c in chapters_data):
                    chapters_data.append({"title": chap_title, "content": chap_text})

        # --- REDE 3: O "Arrastão" (Se não achou capítulos formatados, cata os blocos soltos) ---
        if not any(c['title'] != "Anotações do Autor" for c in chapters_data):
            for block in soup.find_all('div', class_='bbcode'):
                block_text = block.get_text(separator='\n', strip=True)
                if len(block_text) > 100 and not any(block_text[:50] in c['content'] for c in chapters_data):
                    chapters_data.append({"title": "Conteúdo Geral", "content": block_text})

        # --- REDE 4: O MODO DESESPERO LIMPO (FORÇA BRUTA) ---
        if not chapters_data:
            print("    ⚠️ Redes normais falharam. Ativando Modo Desespero (Buscando texto bruto)...")
            maior_bloco = ""

            # Como purificamos o HTML na Fase 0, pegar o 'guide-main' ou o 'body' agora é muito mais seguro
            main_content = soup.find('div', class_='guide-main') or soup.find('div', class_='guide-content')
            if main_content:
                maior_bloco = main_content.get_text(separator='\n', strip=True)
            elif soup.body:
                maior_bloco = soup.body.get_text(separator='\n', strip=True)

            if len(maior_bloco) > 500:
                chapters_data.append({"title": "Conteúdo Bruto (Recuperado na Força)", "content": maior_bloco})

        if chapters_data:
            guide_package = {
                "champion": champion_name,
                "url": url,
                "title": guide_title,
                "author": author_name,
                "tier_filter": "Top Ranked / In-depth",
                "chapters": chapters_data
            }

            file_name = f"{champion_name.lower().replace(' ', '_')}_{author_name.lower()}"

            save_dir = os.path.join("data", "raw", "guides_preview")
            os.makedirs(save_dir, exist_ok=True)
            local_filepath = os.path.join(save_dir, f"{file_name}.json")

            with open(local_filepath, 'w', encoding='utf-8') as f:
                json.dump(guide_package, f, indent=4, ensure_ascii=False)

            print(f"    💾 ARQUIVO SALVO PARA REVISÃO EM: {local_filepath}")
            print(f"    🔍 Capturou {len(chapters_data)} blocos de texto.")

            resposta = input("    👉 O arquivo está bom? Digite 's' para salvar no R2 ou 'n' para cancelar: ")

            if resposta.lower().strip() == 's':
                compress_and_upload(guide_package, "guides", file_name, s3_client)
                print("    ☁️ ✅ Enviado para o R2!")
                return True
            else:
                print("    🛑 Execução Cancelada pelo Arquiteto. Traga os insights para o chat!")
                return False
        else:
            print("    ⚠️ Guia vazio (Não foi encontrado texto legível no DOM). Ignorando.")
            return True

    except Exception as e:
        print(f"    ❌ Falha ao extrair guia: {e}")
        return True

def run_wisdom_ingestion():
    s3 = get_r2_client()
    if not s3:
        print("❌ ERRO: Não foi possível conectar ao Cloudflare R2.")
        return

    champions_to_scrape = ["Lee Sin", "Nidalee", "Elise"]

    with sync_playwright() as p:
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
                continuar = scrape_mobafire_guide(url, champ, s3, page)
                if not continuar:
                    print("\n🔌 Fechando o navegador para depuração...")
                    browser.close()
                    return
                time.sleep(5)

        browser.close()

if __name__ == "__main__":
    run_wisdom_ingestion()
