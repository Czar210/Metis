import requests
import json
import os
import boto3
import time  # <--- O herói que estava faltando!
from dotenv import load_dotenv

load_dotenv()

# Credenciais
R2_ACCOUNT_ID = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

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

def fetch_leaguepedia_players():
    """Usa a Cargo API com Paginação para não tomar ban do Fandom."""
    print("🕵️‍♂️ Consultando o banco de dados da Leaguepedia...")
    url = "https://lol.fandom.com/api.php"

    headers = {
        "User-Agent": "Metis-Data-Ingestion/1.0 (pesquisa acadêmica/dados de esports)"
    }

    pro_players = []
    offset = 0
    limit = 50

    while True:
        params = {
            "action": "cargoquery",
            "format": "json",
            "tables": "Players",
            "fields": "ID, Team, Role, Country",
            "where": "IsRetired='0'",
            "limit": str(limit),
            "offset": str(offset)
        }

        try:
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()

            if "error" in data:
                print(f"⚠️ Erro da Wiki: {data['error']['info']}")
                return None

            entries = data.get("cargoquery", [])

            if not entries:
                break

            for entry in entries:
                pro_players.append(entry["title"])

            print(f"📦 Lote recebido! Total acumulado: {len(pro_players)} jogadores...")

            offset += limit
            time.sleep(2) # Agora o Python sabe o que é isso!

        except requests.exceptions.RequestException as e:
            print(f"❌ Erro de conexão com a Leaguepedia: {e}")
            return None

    return pro_players

def save_to_bronze(data, filename, s3_client):
    """Salva a lista de pro players direto no Cloudflare R2."""
    if not s3_client:
        print("⚠️ S3 Client não configurado.")
        return

    json_string = json.dumps(data, ensure_ascii=False, indent=4)
    file_key = f"pros/{filename}"

    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_key,
            Body=json_string.encode('utf-8'),
            ContentType='application/json'
        )
        print(f"☁️ Sucesso! {file_key} guardado no cofre da Camada Bronze.")
    except Exception as e:
        print(f"❌ Erro ao subir para o R2: {e}")

if __name__ == "__main__":
    s3 = get_r2_client()

    # 1. Puxa os dados
    pros_data = fetch_leaguepedia_players()

    # 2. Trava de Segurança: Só sobe se tiver dados
    if pros_data and len(pros_data) > 0:
        save_to_bronze(pros_data, "leaguepedia_active_pros.json", s3)
    else:
        print("🚫 Upload cancelado! Lista vazia ou erro na API.")
