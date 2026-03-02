import os
import json
import gzip
import boto3
import time
import random
from concurrent.futures import ThreadPoolExecutor
from riotwatcher import LolWatcher, ApiError
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# --- Configurações de Ambiente ---
R2_ACCOUNT_ID = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
RIOT_API_KEY = os.environ.get("RIOT_API_KEY")

# --- Configurações de Performance ---
MAX_WORKERS = 5        # Baixa 5 partidas em paralelo
RATE_LIMIT_PAUSE = 120 # Pausa de 2 min se a Riot gritar 429

# --- utilitários de Conexão e Upload (Camada Bronze) ---

def get_r2_client():
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        print("❌ Credenciais R2 ausentes!")
        return None
    return boto3.client(
        's3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name='auto'
    )

def check_file_exists(s3_client, folder, match_id):
    if not s3_client: return False
    file_key = f"{folder}/{match_id}.json.gz"
    try:
        s3_client.head_object(Bucket=BUCKET_NAME, Key=file_key)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            return False
        return False

def compress_and_upload(data_dict, folder, match_id, s3_client):
    if not s3_client: return
    file_key = f"{folder}/{match_id}.json.gz"
    json_str = json.dumps(data_dict, ensure_ascii=False)
    compressed_data = gzip.compress(json_str.encode('utf-8'))
    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME, Key=file_key,
            Body=compressed_data, ContentType='application/gzip'
        )
        print(f"  ☁️ [{folder}] salvo: {match_id}")
    except Exception as e:
        print(f"  ❌ Erro no upload {match_id}: {e}")

def get_routing_region(server):
    server = server.upper()
    if server in ['BR1', 'NA1', 'LA1', 'LA2']: return 'americas'
    if server in ['EUW1', 'EUN1', 'TR1', 'RU']: return 'europe'
    if server in ['KR', 'JP1']: return 'asia'
    return 'sea'

# --- Lógica de Extração Turbo ---

def get_league_data(lol_watcher, server, tier):
    """Tenta obter a lista de jogadores com retentativas para evitar o erro do Master."""
    for tentativa in range(3):
        try:
            if tier == 'CHALLENGER': return lol_watcher.league.challenger_by_queue(server, 'RANKED_SOLO_5x5')
            if tier == 'GRANDMASTER': return lol_watcher.league.grandmaster_by_queue(server, 'RANKED_SOLO_5x5')
            if tier == 'MASTER': return lol_watcher.league.masters_by_queue(server, 'RANKED_SOLO_5x5')
            if tier == 'DIAMOND': return lol_watcher.league.entries_by_rank(server, 'RANKED_SOLO_5x5', 'DIAMOND', 'I')
        except Exception as e:
            print(f"⚠️ Tentativa {tentativa+1} para {tier} falhou. Retentando...")
            time.sleep(5)
    return None

def process_single_match(match_id, routing_region, lol_watcher, s3_client):
    """Executa o download e upload de uma única partida."""
    if check_file_exists(s3_client, "matches", match_id):
        return "EXISTE"
    try:
        m_data = lol_watcher.match.by_id(routing_region, match_id)
        compress_and_upload(m_data, "matches", match_id, s3_client)

        t_data = lol_watcher.match.timeline_by_match(routing_region, match_id)
        compress_and_upload(t_data, "timelines", match_id, s3_client)
        return "SUCESSO"
    except ApiError as e:
        if e.response.status_code == 429: return "LIMIT"
        return "ERRO"

def fetch_high_elo_turbo(server, target_per_tier=250):
    print(f"🌍 Iniciando Varredura Turbo em {server}...")
    lol_watcher = LolWatcher(RIOT_API_KEY)
    s3 = get_r2_client()
    routing_region = get_routing_region(server)

    # Incluímos DIAMOND para cobrir o "Masters-"
    tiers = ['CHALLENGER', 'GRANDMASTER', 'MASTER', 'DIAMOND']

    for tier in tiers:
        print(f"\n--- Camada: {tier} ---")
        data = get_league_data(lol_watcher, server, tier)
        if not data: continue

        entries = data['entries'] if isinstance(data, dict) else data
        random.shuffle(entries)

        coletadas = 0
        idx = 0

        while coletadas < target_per_tier and idx < len(entries):
            player = entries[idx]
            s_id = player.get('summonerId') or player.get('summonerId') # Fallback para entries
            if not s_id and 'summonerName' in player: s_id = player['summonerName']

            try:
                summ = lol_watcher.summoner.by_id(server, s_id)
                m_list = lol_watcher.match.matchlist_by_puuid(routing_region, summ['puuid'], count=3, type="ranked")

                with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                    results = list(executor.map(lambda mid: process_single_match(mid, routing_region, lol_watcher, s3), m_list))

                novas = results.count("SUCESSO")
                coletadas += novas
                print(f"✅ [{coletadas}/{target_per_tier}] Jogador {idx+1}: +{novas} partidas.")

                if "LIMIT" in results:
                    print(f"⏳ Rate Limit! Pausando {RATE_LIMIT_PAUSE}s...")
                    time.sleep(RATE_LIMIT_PAUSE)
            except Exception:
                pass

            idx += 1
            time.sleep(0.4)

if __name__ == "__main__":
    fetch_high_elo_turbo("BR1", target_per_tier=250)
