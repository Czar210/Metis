import os
import re
import time
import json
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

from scripts.utils.r2_storage import (
    get_r2_client,
    compress_and_upload
)

load_dotenv()
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

def prepare_for_vectorization(text):
    """
    Limpa o texto para uso em modelos de embedding/vetorização.
    Problema principal: o BeautifulSoup gera \n ao redor de tags <a>/<strong>
    que envolvem nomes de campeões e itens, quebrando frases no meio.

    Estratégia:
    - \n entre texto contínuo (sem pontuação antes/depois) → colapsa em espaço
    - \n após pontuação real (. ! ? :) ou bullet-like → mantém como separador
    - Remove espaços duplos e normaliza ao final
    """
    if not text:
        return ""

    # Passo 1: normaliza CRLF e tabs
    text = text.replace('\r\n', '\n').replace('\r', '\n').replace('\t', ' ')

    # Passo 2: colapsa \n que estão no MEIO de uma frase
    # Um \n é "de frase" quando: o char anterior não é pontuação final e
    # o char posterior não é maiúscula isolada ou hífen de lista.
    # Regex: \n que NÃO é precedido por [.!?:\n] e NÃO é seguido por [\n-]
    text = re.sub(r'(?<![.!?:\n])\n(?![\n\-•])', ' ', text)

    # Passo 3: colapsa 3+ quebras de linha consecutivas em 2 (parágrafo)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Passo 4: remove espaços duplicados
    lines = text.split('\n')
    lines = [' '.join(line.split()) for line in lines]
    text = '\n'.join(line for line in lines if line)

    return text.strip()


# Nomes no champion.json (pt-BR) que diferem do slug usado pelo MobaFire (en)
_MOBAFIRE_SLUG_OVERRIDES = {
    "bardo":           "bard",          # champion.json PT-BR: "Bardo"
    "nunu e willump":  "nunu-willump",  # champion.json PT-BR: "Nunu e Willump"
}

VISITED_URLS_FILE = os.path.join("data", "raw", "guides_preview", "_visited_urls.json")

def load_visited_urls():
    if os.path.exists(VISITED_URLS_FILE):
        with open(VISITED_URLS_FILE, encoding='utf-8') as f:
            return set(json.load(f))
    return set()

def save_visited_urls(visited: set):
    os.makedirs(os.path.dirname(VISITED_URLS_FILE), exist_ok=True)
    with open(VISITED_URLS_FILE, 'w', encoding='utf-8') as f:
        json.dump(sorted(visited), f, indent=2, ensure_ascii=False)


def get_champion_slug(champion_name):
    key = champion_name.lower().strip()
    if key in _MOBAFIRE_SLUG_OVERRIDES:
        return _MOBAFIRE_SLUG_OVERRIDES[key]
    slug = key.replace(" ", "-").replace("'", "").replace(".", "")
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

def get_elite_guide_urls(champion_name, page, limit=5):
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
                if len(elite_urls) >= limit:
                    break

    return elite_urls

def scrape_mobafire_guide(url, champion_name, s3_client, page, auto_upload=False, visited_urls=None):
    """Extrai o texto, salva localmente e opcionalmente envia ao R2 sem confirmação."""
    if visited_urls is not None and url in visited_urls:
        print(f"  ⏭️  Já coletado anteriormente, pulando: {url}")
        return True

    print(f"  -> 📖 Infiltrando: {url}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        print("    🖱️ Rolando a página (Buscando o Lazy Loading)...")
        for _ in range(8):
            page.mouse.wheel(0, 1500)
            time.sleep(1.5)

        time.sleep(3)

        raw_html = page.content()
        soup = BeautifulSoup(raw_html, 'html.parser')

        # --- FASE 0: EXTERMINADOR DE LIXO ---
        lixos = [
            'footer', 'nav', 'script', 'style', 'iframe', 'noscript',
            '.view-guide__ad', '.content-ad', '.content_ad',
            '.raptive-content-terms-footer', '.raptive-content-terms-modal',
            '.adthrive-content', '.vote-popup',
            '.view-guide__mobileToc', '.side-toc__main__chapter',
            '.guide-actions__dropdown',
        ]
        for seletor in lixos:
            for node in soup.select(seletor):
                node.decompose()

        # --- TÍTULO E AUTOR (seletores reais do MobaFire atual) ---
        title_tag = (
            soup.find(class_='view-guide__banner__title') or
            soup.find(class_='guide-h1') or
            soup.find('h1')
        )
        guide_title = clean_text(title_tag.get_text()) if title_tag else "Sem Título"

        author_tag = soup.find(class_='view-guide__banner__author')
        author_name = "Desconhecido"
        if author_tag:
            # O nome real fica no alt da imagem: "League of Legends Build Guide Author Peng04"
            img = author_tag.find('img', alt=True)
            if img:
                alt = img['alt']
                # Remove o prefixo padrão e pega só o username
                author_name = alt.replace('League of Legends Build Guide Author', '').strip()
            else:
                raw_author = author_tag.get_text(separator=' ', strip=True)
                author_name = clean_text(raw_author.split('\n')[0].strip())[:40]

        chapters_data = []

        # --- REDE 1: Notas rápidas de build (view-guide__build__notes) ---
        for note in soup.find_all(class_='view-guide__build__notes'):
            note_text = clean_text(note.get_text(separator='\n', strip=True))
            if len(note_text) > 20 and not any(note_text[:80] in c['content'] for c in chapters_data):
                chapters_data.append({"title": "Notas de Build", "content": prepare_for_vectorization(note_text)})

        # --- REDE 2: Capítulos principais (view-guide__chapter) ---
        for chap in soup.find_all(class_='view-guide__chapter'):
            # Título do capítulo fica no __top
            chap_title_tag = chap.find(class_='view-guide__chapter__top')
            if not chap_title_tag:
                chap_title_tag = chap.find(['h2', 'h3', 'h4'])
            chap_title = clean_text(chap_title_tag.get_text()) if chap_title_tag else "Capítulo"

            # Conteúdo textual fica no __content
            content_block = chap.find(class_='view-guide__chapter__content')
            if content_block:
                chap_text = clean_text(content_block.get_text(separator='\n', strip=True))
            else:
                raw_text = chap.get_text(separator='\n', strip=True)
                chap_text = clean_text(raw_text.replace(chap_title, '', 1).strip())

            if len(chap_text) > 40 and not any(chap_text[:100] in c['content'] for c in chapters_data):
                chapters_data.append({"title": chap_title, "content": prepare_for_vectorization(chap_text)})

        # Se nenhuma rede capturou nada, é um guia puramente visual (só builds/runas)
        # A mensagem ⚠️ abaixo trata esse caso corretamente — não há fallback.

        if chapters_data:
            guide_package = {
                "champion": champion_name,
                "url": url,
                "title": guide_title,
                "author": author_name,
                "tier_filter": "Top Ranked / In-depth",
                "chapters": chapters_data
            }

            # Sanitiza o nome do arquivo: remove caracteres inválidos no Windows e troca espaços
            safe_author = re.sub(r'[\\/:\*\?"<>|\n\r\t\s]', '_', author_name.lower()).strip('_.')
            safe_champion = re.sub(r"[\s']", '_', champion_name.lower()).strip('_')
            safe_champion = re.sub(r'_+', '_', safe_champion)
            file_name = f"{safe_champion}_{safe_author}"

            save_dir = os.path.join("data", "raw", "guides_preview")
            os.makedirs(save_dir, exist_ok=True)
            local_filepath = os.path.join(save_dir, f"{file_name}.json")

            with open(local_filepath, 'w', encoding='utf-8') as f:
                json.dump(guide_package, f, indent=4, ensure_ascii=False)

            print(f"    💾 ARQUIVO SALVO PARA REVISÃO EM: {local_filepath}")
            print(f"    🔍 Capturou {len(chapters_data)} blocos de texto.")

            if auto_upload:
                compress_and_upload(guide_package, "guides", file_name, s3_client)
                print("    ☁️ ✅ Enviado para o R2 automaticamente!")
                if visited_urls is not None:
                    visited_urls.add(url)
                    save_visited_urls(visited_urls)
                return True

            resposta = input("    👉 O arquivo está bom? Digite 's' para salvar no R2 ou 'n' para cancelar: ")

            if resposta.lower().strip() == 's':
                compress_and_upload(guide_package, "guides", file_name, s3_client)
                print("    ☁️ ✅ Enviado para o R2!")
                if visited_urls is not None:
                    visited_urls.add(url)
                    save_visited_urls(visited_urls)
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

def run_wisdom_ingestion(champions=None, guides_per_champion=2, headless=False, auto_upload=False):
    """
    Modo Geral: percorre uma lista de campeões, descobre os top guias via
    get_elite_guide_urls e faz o scrape de cada um.

    Args:
        champions:           lista de nomes de campeões, ou None para usar todos
                             do champion.json (172 campeões).
        guides_per_champion: quantos guias pegar por campeão (padrão: 3).
        headless:            True = browser invisível (sem janela).
        auto_upload:         True = envia ao R2 sem pedir confirmação manual.
    """
    s3 = get_r2_client()
    if not s3:
        print("❌ ERRO: Não foi possível conectar ao Cloudflare R2.")
        return

    visited = load_visited_urls()
    print(f"  URLs já visitadas (histórico): {len(visited)}")

    # --- Monta a lista de campeões ---
    if champions is None:
        champ_file = os.path.join("data", "static", "champion.json")
        with open(champ_file, encoding='utf-8') as f:
            data = json.load(f)
        champions = [v['name'] for v in data['data'].values()]

    total = len(champions)
    print(f"\n🏛️  Iniciando ingestão de guias — {total} campeão(s) / {guides_per_champion} guia(s) cada.")
    print(f"  Total máx de guias: {total * guides_per_champion}\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        for idx, champion in enumerate(champions, 1):
            print(f"\n[{idx}/{total}] 🎮 {champion}")

            urls = get_elite_guide_urls(champion, page, limit=guides_per_champion)
            if not urls:
                print(f"  ⚠️ Nenhum guia encontrado para {champion}. Pulando...")
                continue

            print(f"  🔎 {len(urls)} guia(s) encontrado(s).")

            for url in urls:
                continuar = scrape_mobafire_guide(
                    url, champion, s3, page,
                    auto_upload=auto_upload,
                    visited_urls=visited
                )
                if not continuar:
                    print("\n🛑 Execução interrompida pelo usuário.")
                    browser.close()
                    return

        browser.close()

    print("\n✅ Ingestão concluída!")


if __name__ == "__main__":
    import sys

    args = sys.argv[1:]

    auto = '--auto' in args
    headless = '--headless' in args

    # Remove as flags da lista de argumentos
    args = [a for a in args if a not in ('--auto', '--headless')]

    # --guides N  (padrão: 2)
    n_guias = 2
    if '--guides' in args:
        gi = args.index('--guides')
        n_guias = int(args[gi + 1])
        args = args[:gi] + args[gi + 2:]

    champion_list = None

    if '--limit' in args:
        idx = args.index('--limit')
        limit = int(args[idx + 1])
        champ_file = os.path.join("data", "static", "champion.json")
        with open(champ_file, encoding='utf-8') as f:
            all_champs = [v['name'] for v in json.load(f)['data'].values()]
        champion_list = all_champs[:limit]

    elif len(args) > 0:
        # Se sobraram argumentos, eles são os nomes dos campeões específicos
        champion_list = args

    else:
        # Se NÃO tem argumentos na linha de comando além das flags...
        if auto:
            # Modo CI/CD: assume TODOS os campeões silenciosamente
            print("🤖 Modo AUTO ativado. Processando todos os campeões.")
            champion_list = None
        else:
            # Modo Interativo (Manual): pergunta ao usuário
            resposta = input("🎯 Campeões (separados por vírgula) ou Enter para TODOS: ").strip()
            if resposta:
                champion_list = [c.strip() for c in resposta.split(',') if c.strip()]
            else:
                champion_list = None  # todos

            ng = input(f"📖 Quantos guias por campeão? [1-10, padrão={n_guias}]: ").strip()
            if ng.isdigit():
                n_guias = int(ng)

    run_wisdom_ingestion(champions=champion_list, guides_per_champion=n_guias, headless=headless, auto_upload=auto)
