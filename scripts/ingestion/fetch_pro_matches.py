import os
import json
import time
import re
import random
from botocore.exceptions import ClientError
from riotwatcher import LolWatcher, RiotWatcher, ApiError
from dotenv import load_dotenv

from scripts.ingestion.fetch_matches import (
    get_r2_client,
    check_file_exists,
    compress_and_upload
)

load_dotenv()
RIOT_API_KEY = os.environ.get("RIOT_API_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

REGION_MAP = {
    'KR': 'asia', 'JP': 'asia', 'EUW': 'europe', 'EUNE': 'europe',
    'TR': 'europe', 'RU': 'europe', 'NA': 'americas', 'BR': 'americas',
    'LAN': 'americas', 'LAS': 'americas', 'OCE': 'sea', 'PH': 'sea',
    'SG': 'sea', 'TH': 'sea', 'TW': 'sea', 'VN': 'sea'
}

def get_pros_from_bronze(s3_client):
    """Lê a lista de pro players que o scraper da Wiki salvou no R2."""
    print("📂 Abrindo o cofre da Camada Bronze...")
    try:
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key="pros/leaguepedia_active_pros.json")
        json_data = response['Body'].read().decode('utf-8')
        return json.loads(json_data)
    except ClientError as e:
        print(f"❌ Erro ao ler a lista de Pros no R2: {e}")
        return []

def get_blacklist(s3_client):
    """Carrega a lista de nicks inválidos (404) do R2."""
    try:
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key="pros/blacklist_404.json")
        return set(json.loads(response['Body'].read().decode('utf-8')))
    except:
        return set()

def save_blacklist(s3_client, blacklist_set):
    """Salva a lista de nicks inválidos no R2 para não tentar de novo."""
    s3_client.put_object(
        Bucket=BUCKET_NAME, Key="pros/blacklist_404.json",
        Body=json.dumps(list(blacklist_set)).encode('utf-8'),
        ContentType='application/json'
    )

def fetch_pro_matches(target_matches_per_account=2):
    if not RIOT_API_KEY: return
    s3 = get_r2_client()
    if not s3: return

    # AGORA DEFINIDA: Chama a função que estava faltando
    pros_list = get_pros_from_bronze(s3)
    blacklist = get_blacklist(s3)

    riot_watcher = RiotWatcher(RIOT_API_KEY)
    lol_watcher = LolWatcher(RIOT_API_KEY)

    random.shuffle(pros_list)
    total_alvos = len(pros_list)
    new_404s = False

    print(f"🌍 Iniciando Ingestão Integral ({total_alvos} alvos) | Blacklist: {len(blacklist)} nicks")

    for idx, pro in enumerate(pros_list):
        nome_oficial = pro.get("id", "Desconhecido")
        time_do_pro = pro.get("team")
        rota_do_pro = pro.get("role")
        sq_ids_raw = pro.get("soloqueue_ids", "")

        contas_para_tentar = []
        if sq_ids_raw:
            encontrados = re.findall(r'([A-Z]+):\s*([^:\n,]+#[^\s,]+)', sq_ids_raw)
            for servidor_wiki, nick_tag in encontrados:
                contas_para_tentar.append((servidor_wiki, nick_tag.strip()))

        if not contas_para_tentar:
            contas_para_tentar.append(('BR', f"{nome_oficial}#BR1"))

        print(f"\n[{idx+1}/{total_alvos}] 🕵️ {nome_oficial} | 🛡️ {time_do_pro} | ⚔️ {rota_do_pro}")

        for servidor_wiki, conta in contas_para_tentar:
            continente = REGION_MAP.get(servidor_wiki)
            if not continente: continue

            conta_limpa = conta.replace("'", "").replace('"', '').strip()

            if conta_limpa in blacklist:
                print(f"  ⏭️ '{conta_limpa}' ignorado (Blacklist/404).")
                continue

            try:
                nick, tag = conta_limpa.split("#", 1)
                account_data = riot_watcher.account.by_riot_id(continente, nick.strip(), tag.strip())
                puuid = account_data['puuid']

                match_ids = lol_watcher.match.matchlist_by_puuid(continente, puuid, count=target_matches_per_account, type="ranked")

                if not match_ids:
                    print(f"    🤷‍♂️ Sem ranqueadas recentes.")
                    continue

                for m_id in match_ids:
                    if not check_file_exists(s3, "matches", m_id):
                        m_data = lol_watcher.match.by_id(continente, m_id)
                        compress_and_upload(m_data, "matches", m_id, s3)
                        t_data = lol_watcher.match.timeline_by_match(continente, m_id)
                        compress_and_upload(t_data, "timelines", m_id, s3)
                        time.sleep(1.2)

                print(f"  🎯 Partidas capturadas!")
                break

            except ApiError as e:
                if e.response.status_code == 404:
                    print(f"    🥷 404 Detectado. Adicionando '{conta_limpa}' à blacklist.")
                    blacklist.add(conta_limpa)
                    new_404s = True
                elif e.response.status_code == 429:
                    wait = int(e.response.headers.get('Retry-After', 20))
                    time.sleep(wait)
            except Exception:
                pass

    if new_404s:
        save_blacklist(s3, blacklist)
        print(f"💾 Blacklist atualizada com sucesso no R2.")

if __name__ == "__main__":
    fetch_pro_matches(target_matches_per_account=2)
