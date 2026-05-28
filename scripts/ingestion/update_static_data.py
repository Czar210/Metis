import requests
import json
import os
from pathlib import Path
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

DATA_STATIC_DIR = Path(__file__).parents[2] / "data" / "static"
# Tipos que precisam estar disponiveis localmente para outros scripts (sync_items, etc)
_SAVE_LOCALLY = {"item", "runesReforged", "championFull"}

R2_ACCOUNT_ID = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")


def get_r2_client():
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        print("AVISO: Chaves do R2 ausentes nas variaveis de ambiente.")
        return None
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def get_recent_versions(limit=3):
    url = "https://ddragon.leagueoflegends.com/api/versions.json"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()[:limit]


def check_file_exists(s3_client, file_key):
    if not s3_client:
        return False
    try:
        s3_client.head_object(Bucket=BUCKET_NAME, Key=file_key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        print(f"AVISO: Erro ao verificar existencia no R2: {e}")
        return False


def _save_locally(data_type: str, json_string: str) -> None:
    DATA_STATIC_DIR.mkdir(parents=True, exist_ok=True)
    dest = DATA_STATIC_DIR / f"{data_type}.json"
    dest.write_text(json_string, encoding="utf-8")
    print(f"Salvo localmente: {dest}")


def process_ddragon_data(version, data_type, s3_client):
    file_key = f"static/{version}/{data_type}.json"
    url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/pt_BR/{data_type}.json"

    if check_file_exists(s3_client, file_key):
        print(f"R2 ja tem: {file_key}. Verificando copia local...")
        if data_type in _SAVE_LOCALLY:
            local_path = DATA_STATIC_DIR / f"{data_type}.json"
            if not local_path.exists():
                print(f"Baixando {data_type} para uso local...")
                response = requests.get(url)
                if response.status_code == 200:
                    _save_locally(data_type, json.dumps(response.json(), ensure_ascii=False, indent=4))
        return

    print(f"Baixando {data_type} da versao {version}...")
    response = requests.get(url)
    if response.status_code != 200:
        print(f"AVISO: Riot ainda nao liberou os dados da versao {version}.")
        return

    data = response.json()
    json_string = json.dumps(data, ensure_ascii=False, indent=4)

    if s3_client:
        try:
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=file_key,
                Body=json_string.encode("utf-8"),
                ContentType="application/json",
            )
            print(f"Upload R2 OK: {file_key}")
        except ClientError as e:
            print(f"ERRO ao subir para o R2: {e}")

    if data_type in _SAVE_LOCALLY:
        _save_locally(data_type, json_string)


if __name__ == "__main__":
    try:
        recent_patches = get_recent_versions(limit=3)
        print(f"Patches na fila: {recent_patches}")

        s3 = get_r2_client()

        for patch in recent_patches:
            print(f"\n--- Patch {patch} ---")
            process_ddragon_data(patch, "championFull", s3)
            process_ddragon_data(patch, "item", s3)
            process_ddragon_data(patch, "runesReforged", s3)
            process_ddragon_data(patch, "summoner", s3)

        print("\nRotina estatica finalizada.")
    except Exception as e:
        print(f"ERRO critico na rotina: {e}")
