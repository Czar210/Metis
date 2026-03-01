import os
import json
import time
import re
from botocore.exceptions import ClientError
from riotwatcher import LolWatcher, ApiError
from dotenv import load_dotenv

# Reutilizando a infraestrutura de Zaun que já funciona
from scripts.ingestion.fetch_matches import (
    get_r2_client,
    get_routing_region,
    check_file_exists,
    compress_and_upload
)

load_dotenv()
RIOT_API_KEY = os.environ.get("RIOT_API_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

def get_pros_from_bronze(s3_client):
    """Lê o arquivo JSON com os pros e suas contas SoloQ direto do Cloudflare R2."""
    print("📂 Abrindo o cofre da Camada Bronze para pegar a lista do Olimpo...")
    try:
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key="pros/leaguepedia_active_pros.json")
        json_data = response['Body'].read().decode('utf-8')
        return json.loads(json_data)
    except ClientError as e:
        print(f"❌ Erro ao ler a lista de Pros no R2: {e}")
        return []

def fetch_pro_matches(server="BR1", target_matches_per_account=3):
    """
    Motor que itera sobre os profissionais, extrai as tags corretas e tenta baixar as partidas.
    """
    if not RIOT_API_KEY:
        print("❌ RIOT_API_KEY ausente.")
        return

    s3 = get_r2_client()
    if not s3: return

    pros_list = get_pros_from_bronze(s3)
    if not pros_list:
        print("⚠️ A lista de pros está vazia. Rode o script do Playwright primeiro.")
        return

    lol_watcher = LolWatcher(RIOT_API_KEY)
    region = get_routing_region(server)

    print(f"🚀 Iniciando a Ingestão do Olimpo (Modo Caçador) no servidor {server}...")

    sucessos = 0

    # Vamos limitar aos 50 primeiros para o teste inicial não gastar toda a sua chave
    for idx, pro in enumerate(pros_list[:50]):
        nome_oficial = pro.get("id")
        sq_ids_raw = pro.get("soloqueue_ids", "")

        # 1. Cria uma lista de possíveis contas para tentar
        contas_para_tentar = []

        # O Regex abaixo procura Nick#Tag dentro da string suja da Wiki
        if sq_ids_raw:
            encontrados = re.findall(r'([^:\n,]+#[^\s,]+)', sq_ids_raw)
            for acc in encontrados:
                contas_para_tentar.append(acc.strip())

        # Se a Leaguepedia não tem a tag, tentamos o plano B: Nick#Servidor (Ex: brTT#BR1)
        if not contas_para_tentar:
            contas_para_tentar.append(f"{nome_oficial}#{server}")

        print(f"\n[{idx+1}/50] Analisando a lenda: {nome_oficial} ({len(contas_para_tentar)} contas conhecidas)")

        # 2. Tenta puxar partidas de cada conta
        for conta in contas_para_tentar:
            try:
                # Separa o Nick da Tag com cuidado
                nick, tag = conta.split("#", 1)
                nick = nick.strip()
                tag = tag.strip()

                # Se o Regex pegou alguma sujeira e o nick ficou vazio, pula
                if not nick or not tag: continue

                account_data = lol_watcher.account.by_riot_id(region, nick, tag)
                puuid = account_data['puuid']

                match_ids = lol_watcher.match.matchlist_by_puuid(region, puuid, count=target_matches_per_account, type="ranked")

                if not match_ids:
                    continue # Se a conta não tem ranqueada recente, tenta a próxima da lista

                for m_id in match_ids:
                    if check_file_exists(s3, "matches", m_id):
                        print(f"  ⏭️ Partida {m_id} já existe no cofre.")
                        continue

                    # Faz o download das novidades
                    m_data = lol_watcher.match.by_id(region, m_id)
                    compress_and_upload(m_data, "matches", m_id, s3)

                    t_data = lol_watcher.match.timeline_by_match(region, m_id)
                    compress_and_upload(t_data, "timelines", m_id, s3)

                    sucessos += 1
                    time.sleep(1.2) # Respeitando a Riot

                print(f"  🎯 Sucesso! Partidas capturadas da conta: {conta}")
                break # Se achamos os dados em uma conta, podemos pular as outras para economizar a API

            except ValueError:
                pass # Ignora se falhou no split('#')
            except ApiError as e:
                # Se a Riot disser 404 (Conta não existe), apenas pulamos pro próximo 'for conta' silenciosamente
                if e.response.status_code == 429:
                    wait = int(e.response.headers.get('Retry-After', 10))
                    print(f"  ⚠️ Limite de requisições! Dormindo {wait}s...")
                    time.sleep(wait)
            except Exception as e:
                pass

    print("\n==================================================")
    print(f"✨ Ingestão do Olimpo Finalizada!")
    print(f"📈 Partidas novas injetadas na Camada Bronze: {sucessos}")
    print("==================================================")

if __name__ == "__main__":
    # Teste focado no Brasil
    fetch_pro_matches(server="BR1", target_matches_per_account=3)
