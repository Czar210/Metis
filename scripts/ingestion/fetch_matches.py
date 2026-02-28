import os
import json
import gzip
import boto3
import time
from botocore.exceptions import ClientError
from riotwatcher import LolWatcher, RiotWatcher, ApiError
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

def check_file_exists(s3_client, folder, match_id):
    """Bate na porta do R2 para ver se o arquivo já existe."""
    if not s3_client:
        return False

    file_key = f"{folder}/{match_id}.json.gz"
    try:
        s3_client.head_object(Bucket=BUCKET_NAME, Key=file_key)
        return True # Já existe!
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            return False
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

def fetch_player_matches(game_name, tag_line, server, count, s3_client):
    """Motor de Extração: Busca as partidas ranqueadas e devolve um relatório para a API."""
    if not RIOT_API_KEY:
        return {"error": "RIOT_API_KEY não encontrada", "status": "failed"}

    riot_watcher = RiotWatcher(RIOT_API_KEY)
    lol_watcher = LolWatcher(RIOT_API_KEY)
    routing_region = get_routing_region(server)

    # O Relatório de Completude que será enviado para o Frontend
    stats = {
        "requested": count,
        "downloaded_new": 0,
        "skipped_existing": 0,
        "failed": 0,
        "status": "processing"
    }

    try:
        print(f"\n🔍 Buscando o PUUID de {game_name}#{tag_line} no servidor {server}...")
        account = riot_watcher.account.by_riot_id(routing_region, game_name, tag_line)
        puuid = account['puuid']

        print(f"✅ PUUID encontrado! Buscando as últimas {count} partidas RANQUEADAS...")
        match_history = lol_watcher.match.matchlist_by_puuid(
            routing_region, puuid, count=count, type="ranked"
        )

        if not match_history:
            stats["status"] = "success"
            stats["message"] = "Nenhuma partida ranqueada encontrada."
            return stats

        print(f"🎮 {len(match_history)} partidas na fila. Iniciando extração...\n")

        for index, match_id in enumerate(match_history, start=1):
            print(f"--- Processando Partida {index}/{len(match_history)}: {match_id} ---")

            # Checa se o Match E a Timeline já existem
            if check_file_exists(s3_client, "matches", match_id) and check_file_exists(s3_client, "timelines", match_id):
                print(f"⏭️ Partida {match_id} completa já existe no R2. Pulando!")
                stats["skipped_existing"] += 1
                continue

            try:
                # Baixa e comprime a Partida
                match_data = lol_watcher.match.by_id(routing_region, match_id)
                compress_and_upload(match_data, "matches", match_id, s3_client)

                # Baixa e comprime a Timeline
                timeline_data = lol_watcher.match.timeline_by_match(routing_region, match_id)
                compress_and_upload(timeline_data, "timelines", match_id, s3_client)

                stats["downloaded_new"] += 1
                time.sleep(1.5) # Pausa de segurança da API da Riot

            except Exception as e:
                print(f"❌ Erro ao baixar partida {match_id}: {e}")
                stats["failed"] += 1

        stats["status"] = "success"
        stats["message"] = f"Completude: {stats['downloaded_new'] + stats['skipped_existing']}/{stats['requested']} partidas verificadas."
        return stats

    except Exception as err:
        print(f"❌ Erro Crítico: {err}")
        stats["status"] = "error"
        stats["error"] = str(err)
        return stats

# O bloco abaixo serve APENAS para testes diretos no terminal.
# Quando a FastAPI rodar, ela vai ignorar isso aqui.
if __name__ == "__main__":
    s3_test = get_r2_client()

    # Teste rápido de 3 partidas. Altere para o seu nick.
    resultado = fetch_player_matches("SeuNick", "BR1", "BR1", 3, s3_test)

    print("\n📊 Relatório Final devolvido para a API:")
    print(json.dumps(resultado, indent=4, ensure_ascii=False))
