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
    'KR': 'asia', 'JP': 'asia',
    'EUW': 'europe', 'EUNE': 'europe', 'TR': 'europe', 'RU': 'europe',
    'NA': 'americas', 'BR': 'americas', 'LAN': 'americas', 'LAS': 'americas',
    'OCE': 'sea', 'PH': 'sea', 'SG': 'sea', 'TH': 'sea', 'TW': 'sea', 'VN': 'sea'
}

def get_pros_from_bronze(s3_client):
    print("📂 Abrindo o cofre da Camada Bronze...")
    try:
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key="pros/leaguepedia_active_pros.json")
        json_data = response['Body'].read().decode('utf-8')
        return json.loads(json_data)
    except ClientError as e:
        print(f"❌ Erro ao ler a lista de Pros: {e}")
        return []

def fetch_pro_matches(target_matches_per_account=2):
    if not RIOT_API_KEY:
        print("❌ RIOT_API_KEY não encontrada.")
        return

    s3 = get_r2_client()
    if not s3: return

    pros_list = get_pros_from_bronze(s3)
    if not pros_list: return

    # Inicia os DOIS motores da Riot
    riot_watcher = RiotWatcher(RIOT_API_KEY)
    lol_watcher = LolWatcher(RIOT_API_KEY)

    random.shuffle(pros_list)
    alvos_teste = pros_list[:50]

    print(f"🌍 Iniciando a Ingestão Global (Modo Verbose) com {len(alvos_teste)} alvos aleatórios...\n")

    sucessos = 0

    for idx, pro in enumerate(alvos_teste):
        nome_oficial = pro.get("id", "Desconhecido")
        time_do_pro = pro.get("team", "Sem Time")
        rota_do_pro = pro.get("role", "Desconhecida")
        sq_ids_raw = pro.get("soloqueue_ids", "")

        contas_para_tentar = []

        if sq_ids_raw:
            encontrados = re.findall(r'([A-Z]+):\s*([^:\n,]+#[^\s,]+)', sq_ids_raw)
            for servidor_wiki, nick_tag in encontrados:
                contas_para_tentar.append((servidor_wiki, nick_tag.strip()))

        if not contas_para_tentar:
            contas_para_tentar.append(('BR', f"{nome_oficial}#BR1"))

        print(f"\n[{idx+1}/50] 🕵️ Lenda: {nome_oficial} | 🛡️ Time: {time_do_pro} | ⚔️ Rota: {rota_do_pro}")

        for servidor_wiki, conta in contas_para_tentar:
            continente = REGION_MAP.get(servidor_wiki)
            if not continente:
                print(f"  ⏭️ Servidor '{servidor_wiki}' ignorado (Não suportado pela Riot).")
                continue

            conta_limpa = conta.replace("'", "").replace('"', '').strip()

            print(f"  -> Sondando conta: '{conta_limpa}' na rota '{continente}'...")

            try:
                nick, tag = conta_limpa.split("#", 1)

                # Busca o PUUID
                account_data = riot_watcher.account.by_riot_id(continente, nick.strip(), tag.strip())
                puuid = account_data['puuid']
                print(f"    ✔️ PUUID encontrado! Buscando histórico...")

                # Busca as Partidas
                match_ids = lol_watcher.match.matchlist_by_puuid(continente, puuid, count=target_matches_per_account, type="ranked")

                if not match_ids:
                    print(f"    🤷‍♂️ Sem ranqueadas recentes nesta conta.")
                    continue

                print(f"    🎮 {len(match_ids)} partidas encontradas! Iniciando download...")

                for m_id in match_ids:
                    if check_file_exists(s3, "matches", m_id):
                        print(f"      ⏭️ {m_id} já existe no R2. Pulando.")
                        continue

                    m_data = lol_watcher.match.by_id(continente, m_id)
                    compress_and_upload(m_data, "matches", m_id, s3)

                    t_data = lol_watcher.match.timeline_by_match(continente, m_id)
                    compress_and_upload(t_data, "timelines", m_id, s3)

                    sucessos += 1
                    time.sleep(1.2)

                print(f"  🎯 GOLPE DE MESTRE! Dados salvos com sucesso.")
                break

            except ValueError:
                print(f"    ⚠️ Erro de formatação no Nick#Tag. A Wiki mandou lixo: {conta_limpa}")
            except ApiError as e:
                if e.response.status_code == 404:
                    print(f"    🥷 Erro 404: Conta não existe ou o nick mudou.")
                elif e.response.status_code == 429:
                    wait = int(e.response.headers.get('Retry-After', 10))
                    print(f"    ⏳ Limite da Riot (429)! Pausando por {wait} segundos...")
                    time.sleep(wait)
                else:
                    print(f"    ❌ Erro na API da Riot: {e.response.status_code}")
            except Exception as e:
                print(f"    ❌ Erro inesperado do sistema: {e}")

    print("\n==================================================")
    print(f"✨ Ingestão do Olimpo Global Finalizada!")
    print(f"📈 Partidas de Pro Players injetadas no R2: {sucessos}")
    print("==================================================")

if __name__ == "__main__":
    fetch_pro_matches(target_matches_per_account=2)
