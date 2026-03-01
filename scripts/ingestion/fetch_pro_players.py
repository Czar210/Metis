import os
import json
import time
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

# Reutilizando seu motor do R2
from scripts.ingestion.fetch_matches import get_r2_client

load_dotenv()
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

def fetch_pro_players_playwright():
    """Usa um navegador fantasma para extrair os dados da Wiki, incluindo as contas Smurfs."""
    print("🎭 Invocando o Navegador Fantasma (Playwright)...")

    # URL turbinada: Adicionamos o campo 'SoloqueueIds'
    url = (
        "https://lol.fandom.com/wiki/Special:CargoExport"
        "?tables=Players"
        "&fields=ID,Team,Role,Country,SoloqueueIds"
        "&where=IsRetired='0' "
        "AND Role IN ('Top', 'Jungle', 'Mid', 'Bot', 'Support') "
        "AND Team != '' AND Team IS NOT NULL"
        "&limit=5000"
        "&format=json"
    )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        print("🕵️‍♂️ Acessando a Leaguepedia sorrateiramente...")
        try:
            page.goto(url, wait_until="domcontentloaded")
            time.sleep(3) # Tempo para o Cloudflare não desconfiar

            content = page.locator("body").inner_text()
            data = json.loads(content)

            if isinstance(data, list) and len(data) > 0:
                print(f"✅ Sucesso! O disfarce funcionou. {len(data)} pro players capturados.")

                # Salvamos o pacote completo de dados úteis!
                pros_data = []
                for player in data:
                    pros_data.append({
                        "id": player.get("ID"),
                        "team": player.get("Team"),
                        "role": player.get("Role"),
                        "soloqueue_ids": player.get("SoloqueueIds", "")
                    })

                browser.close()
                return pros_data
            else:
                print("⚠️ Formato inesperado. O segurança da Wiki pode ter mudado a fechadura.")
                browser.close()
                return None

        except json.JSONDecodeError:
            print("❌ Erro ao ler os dados. A Wiki não retornou um JSON válido (Possível Captcha).")
            browser.close()
            return None
        except Exception as e:
            print(f"❌ Erro durante a infiltração: {e}")
            browser.close()
            return None

def save_to_bronze(data, filename, s3_client):
    """Guarda a nossa lista rica em alvos no cofre."""
    if not s3_client: return

    json_string = json.dumps(data, ensure_ascii=False, indent=4)
    file_key = f"pros/{filename}"

    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME, Key=file_key, Body=json_string.encode('utf-8'),
            ContentType='application/json'
        )
        print(f"☁️ Arquivo salvo com segurança no R2: {file_key}")
    except Exception as e:
        print(f"❌ Erro no R2: {e}")

if __name__ == "__main__":
    s3 = get_r2_client()
    pros_list = fetch_pro_players_playwright()

    if pros_list:
        save_to_bronze(pros_list, "leaguepedia_active_pros.json", s3)
    else:
        print("🚫 A missão falhou.")
