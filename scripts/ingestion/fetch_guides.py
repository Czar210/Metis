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

def clean_text(raw_text):
    """
    Limpa tabulações e múltiplos espaços, mas AGORA PRESERVA as quebras de linha (\n).
    Isso é crucial para manter listas (bullet points) e parágrafos organizados para a IA.
    """
    if not raw_text:
        return ""

    # Quebra o texto por linhas
    linhas = raw_text.split('\n')

    # Limpa os espaços extras dentro de cada linha
    linhas_limpas = [' '.join(linha.split()) for linha in linhas]

    # Remove as linhas que ficaram vazias e junta tudo de novo com 1 quebra de linha
    texto_final = '\n'.join([linha for linha in linhas_limpas if linha])

    return texto_final

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
            full_url = f"https://www.mobafire.com{href}" if href.startswith('/') else href
            if full_url not in elite_urls:
                elite_urls.append(full_url)
                if len(elite_urls) >= 3:
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

        # --- FASE 0: EXTERMINADOR DE LIXO ---
        lixos = [
            'footer', 'nav', 'script', 'style', 'iframe', 'noscript',
            '.mf-head', '.mf-footer', '#venatus-ad', '.ad-container',
            '.comment-list', '.guide-comments', '.social-share',
            '.network-bar', '.more-guides', '.champ-list', '.footer-links',
            '.toc', '.guide-sidebar' # Limpa também a barra lateral de navegação
        ]
        for seletor in lixos:
            for node in soup.select(seletor):
                node.decompose()

        title_tag = soup.find('h1', class_='guide-main-title')
        guide_title = clean_text(title_tag.text) if title_tag else "Sem Título"

        author_tag = soup.find('span', class_='author-name')
        author_name = clean_text(author_tag.text) if author_tag else "Desconhecido"

        chapters_data = []

        # --- REDE 1: Anotações Extras (Pequenas) ---
        for note in soup.find_all(['div', 'span'], class_=['build-text', 'champ-build__notes', 'matchup-notes', 'notes']):
            note_text = clean_text(note.get_text(separator='\n', strip=True))
            # Relaxando o filtro de tamanho para pegar anotações mais curtas se houver
            if len(note_text) > 20 and not any(note_text in c['content'] for c in chapters_data):
                chapters_data.append({"title": "Anotações do Autor", "content": note_text})

        # --- REDE 2: Capítulos (Suporta o Layout Antigo e o NOVO Layout) ---
        # Removido a restrição que impedia o Arrastão (Rede 3) se a Rede 1 achasse algo.
        capitulos_encontrados = False
        for chap in soup.find_all(['div', 'section'], class_=['guide-chapter', 'champ-build__section', 'view-guide__section']):
            chap_title_tag = chap.find(['h2', 'h3', 'div'], class_=['champ-build__section__header', 'guide-chapter-title', 'view-guide__section__title'])
            if not chap_title_tag:
                chap_title_tag = chap.find(['h2', 'h3'])

            chap_title = clean_text(chap_title_tag.text) if chap_title_tag else "Capítulo"

            text_block = chap.find(['div', 'article'], class_=['bbcode', 'champ-build__section__content', 'guide-chapter-content', 'view-guide__section__content', 'mf-redumb-content'])
            if text_block:
                chap_text = clean_text(text_block.get_text(separator='\n', strip=True))
            else:
                raw_text = chap.get_text(separator='\n', strip=True)
                if chap_title in raw_text:
                    raw_text = raw_text.replace(chap_title, "", 1).strip()
                chap_text = clean_text(raw_text)

            if len(chap_text) > 40: # Reduzido de 50 para 40
                if not any(chap_text[:100] in c['content'] for c in chapters_data):
                    chapters_data.append({"title": chap_title, "content": chap_text})
                    capitulos_encontrados = True

        # --- REDE 3: O "Arrastão" ---
        # Agora roda INDEPENDENTE da Rede 1 (Anotações). Foca no conteúdo principal solto.
        for block in soup.find_all('div', class_=['bbcode', 'mf-redumb-content']):
            block_text = clean_text(block.get_text(separator='\n', strip=True))

            # Filtro mais inteligente: Se o texto for longo e NÃO estiver nos capítulos já encontrados
            if len(block_text) > 80 and not any(block_text[:50] in c['content'] for c in chapters_data):
                 # Tenta extrair um título provisório se houver tags <b> ou <strong> no início
                 prov_title = "Conteúdo Geral"
                 strong_tag = block.find(['b', 'strong', 'h3', 'h4'])
                 if strong_tag:
                     prov_title_text = clean_text(strong_tag.get_text(separator=' ', strip=True))
                     if len(prov_title_text) < 50: # Evita títulos gigantes
                         prov_title = prov_title_text

                 chapters_data.append({"title": prov_title, "content": block_text})

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
            print("    ⚠️ Guia estritamente visual (Sem textos longos explicativos). Ignorando para manter a qualidade da IA.")
            return True

    except Exception as e:
        print(f"    ❌ Falha ao extrair guia: {e}")
        return True

def run_specific_test():
    """Modo Sniper: Testa apenas a URL da Ahri que o Arquiteto pediu."""
    s3 = get_r2_client()
    if not s3:
        print("❌ ERRO: Não foi possível conectar ao Cloudflare R2.")
        return

    test_url = "https://www.mobafire.com/league-of-legends/build/26-5-pengs-ahri-guide-3-2mil-points-11x-challenger-648700"
    champion = "Ahri"

    print("🎯 Iniciando o Modo Sniper para testes diretos...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        scrape_mobafire_guide(test_url, champion, s3, page)

        browser.close()

if __name__ == "__main__":
    # Trocamos para rodar o modo Sniper. Quando quiser a varredura total,
    # basta trocar para run_wisdom_ingestion() novamente!
    run_specific_test()
