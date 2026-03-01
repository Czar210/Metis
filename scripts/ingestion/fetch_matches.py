import os
import json
import gzip
import boto3
import time
from riotwatcher import LolWatcher, RiotWatcher, ApiError
from botocore.exceptions import ClientError # <-- Adicionado para lidar com o R2
from dotenv import load_dotenv

load_dotenv()

# Credenciais
R2_ACCOUNT_ID = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
RIOT_API_KEY = os.environ.get("RIOT_API_KEY")

def get_r2_client():
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        return None
    return boto3.client(
        's3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name='auto'
    )

def check_file_exists(s3_client, folder, match_id):
    """Bate na porta do R2 para ver se a cópia já existe. Impede duplicatas."""
    if not s3_client:
        return False

    file_key = f"{folder}/{match_id}.json.gz"
    try:
        s3_client.head_object(Bucket=BUCKET_NAME, Key=file_key)
        return True # Arquivo já existe!
    except ClientError as e:
        # Erro 404 significa que o arquivo não está lá, então podemos baixar
        if e.response['Error']['Code'] == '404':
            return False
        else:
            print(f"⚠️ Erro ao verificar existência no R2: {e}")
            return False

def compress_and_upload(data_dict, folder, match_id, s3_client):
    """Transforma o JSON em texto, espreme em GZIP e joga pro R2."""
    if not s3_client:
        return

    file_key = f"{folder}/{match_id}.json.gz"
    json_str = json.dumps(data_dict, ensure_ascii=False)
    compressed_data = gzip.compress(json_str.encode('utf-8'))

    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_key,
            Body=compressed_data,
            ContentType='application/gzip'
        )
        print(f"  ☁️ [{folder}] salvo no R2: {file_key}")
    except Exception as e:
        print(f"  ❌ Erro ao subir {file_key}: {e}")

def get_routing_region(server):
    """A Riot exige continentes para a API de partidas."""
    server = server.upper()
    if server in ['BR1', 'NA1', 'LA1', 'LA2']:
        return 'americas'
    elif server in ['EUW1', 'EUN1', 'TR1', 'RU']:
        return 'europe'
    elif server in ['KR', 'JP1']:
        return 'asia'
    else:
        return 'sea'

def fetch_player_matches(game_name, tag_line, server, count=5, s3_client=None):
    """Motor de Extração: Busca as últimas X partidas RANQUEADAS de um jogador."""
    if not RIOT_API_KEY:
        print("❌ RIOT_API_KEY não encontrada no .env!")
        return False

    riot_watcher = RiotWatcher(RIOT_API_KEY)
    lol_watcher = LolWatcher(RIOT_API_KEY)

    routing_region = get_routing_region(server)

    try:
        print(f"\n🔍 Buscando o PUUID de {game_name}#{tag_line} no servidor {server}...")
        account = riot_watcher.account.by_riot_id(routing_region, game_name, tag_line)
        puuid = account['puuid']

        print(f"✅ PUUID encontrado! Buscando as últimas {count} partidas RANQUEADAS...")

        match_history = lol_watcher.match.matchlist_by_puuid(
            routing_region,
            puuid,
            count=count,
            type="ranked"
        )

        if not match_history:
            print("🤷‍♂️ Nenhuma partida ranqueada encontrada para este jogador.")
            return True

        print(f"🎮 {len(match_history)} partidas encontradas na fila. Iniciando extração...\n")

        for index, match_id in enumerate(match_history, start=1):
            print(f"--- Processando Partida {index}/{len(match_history)}: {match_id} ---")

            # Agora o próprio motor base também se protege de baixar duplicatas!
            if check_file_exists(s3_client, "matches", match_id):
                print(f"  ⏭️ Partida {match_id} já existe no R2. Pulando.")
                continue

            match_data = lol_watcher.match.by_id(routing_region, match_id)
            compress_and_upload(match_data, "matches", match_id, s3_client)

            timeline_data = lol_watcher.match.timeline_by_match(routing_region, match_id)
            compress_and_upload(timeline_data, "timelines", match_id, s3_client)

            time.sleep(1.5)

        print("\n🚀 Missão cumprida! Todas as partidas foram extraídas e comprimidas.")
        return True

    except ApiError as err:
        if err.response.status_code == 429:
            print("⚠️ Rate Limit da Riot! Atingimos o limite de requisições por segundo.")
        elif err.response.status_code == 404:
            print("❌ Jogador ou partida não encontrados.")
        else:
            print(f"❌ Erro na Riot API: {err}")
        return False

if __name__ == "__main__":
    print("=======================================")
    print("🤖 METIS - EXTRATOR DE PARTIDAS (PROD) ")
    print("=======================================\n")

    s3 = get_r2_client()

    ALVO_NICK = "SeuNick"
    ALVO_TAG = "BR1"
    ALVO_SERVIDOR = "BR1"
    QTD_PARTIDAS = 3

    fetch_player_matches(ALVO_NICK, ALVO_TAG, ALVO_SERVIDOR, QTD_PARTIDAS, s3)
