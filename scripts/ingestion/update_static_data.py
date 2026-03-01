import requests
import json
import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Carrega as chaves do arquivo .env para a memória do Python
load_dotenv()

# Credenciais da Camada Bronze (Cloudflare R2) - Agora com os nomes exatos do seu .env
R2_ACCOUNT_ID = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis") # Usa a variável ou o padrão 'metis'

def get_r2_client():
    """Cria a ponte de conexão com o Cloudflare R2."""
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        print("⚠️ Chaves do R2 ausentes nas variáveis de ambiente.")
        return None

    return boto3.client(
        's3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name='auto'
    )


def get_recent_versions(limit=3):
    """
    Busca as versões do LoL. Como a API retorna uma lista gigante,
    usamos o fatiamento [:limit] para pegar exatamente os últimos N patches.
    """
    url = "https://ddragon.leagueoflegends.com/api/versions.json"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()[:limit]


def check_file_exists(s3_client, file_key):
    """Bate na porta do R2 para ver se a cópia já existe. Impede duplicatas."""
    if not s3_client:
        return False
    try:
        s3_client.head_object(Bucket=BUCKET_NAME, Key=file_key)
        return True # Arquivo já existe!
    except ClientError as e:
        # Erro 404 significa que o arquivo não está lá, então precisamos baixar
        if e.response['Error']['Code'] == '404':
            return False
        else:
            print(f"⚠️ Erro ao verificar existência no R2: {e}")
            return False


def process_ddragon_data(version, data_type, s3_client):
    """Garante que a cópia de um patch específico esteja no Bucket."""
    file_key = f"static/{version}/{data_type}.json"

    # 1. Regra de Ouro: Não fazer upload duplicado
    if check_file_exists(s3_client, file_key):
        print(f"⏭️ Cópia já existe no R2: {file_key}. Pulando...")
        return

    # 2. Se não existe, puxa da Riot
    url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/pt_BR/{data_type}.json"
    print(f"⬇️ Baixando {data_type} da versão {version}...")

    response = requests.get(url)
    if response.status_code != 200:
        print(f"⚠️ Aviso: A Riot ainda não liberou os dados da versão {version}.")
        return

    data = response.json()
    json_string = json.dumps(data, ensure_ascii=False, indent=4)

    # 3. Arremessa pro R2
    if s3_client:
        try:
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=file_key,
                Body=json_string.encode('utf-8'),
                ContentType='application/json'
            )
            print(f"☁️ Sucesso! {file_key} guardado no cofre da Camada Bronze.")
        except ClientError as e:
            print(f"❌ Erro ao subir para o R2: {e}")


if __name__ == "__main__":
    try:
        # Pegamos a LISTA dos últimos 3 patches!
        recent_patches = get_recent_versions(limit=3)
        print(f"📋 Patches na fila de verificação: {recent_patches}")

        # Inicia o motor do R2
        s3 = get_r2_client()

        # Faz um loop garantindo que temos TODOS os dicionários para os 3 patches
        for patch in recent_patches:
            print(f"\n--- Analisando Patch {patch} ---")

            # A GRANDE MUDANÇA: Trocamos 'champion' por 'championFull'
            # O championFull tem a matemática das habilidades (dano, cooldown, escalonamento)
            process_ddragon_data(patch, "championFull", s3)

            process_ddragon_data(patch, "item", s3)

            # ADIÇÕES: Runas e Feitiços de Invocador (Flash, Ignite)
            process_ddragon_data(patch, "runesReforged", s3)
            process_ddragon_data(patch, "summoner", s3)

        print("\n✅ Rotina Estática finalizada! Temos os dicionários completos garantidos.")
    except Exception as e:
        print(f"❌ Erro crítico na rotina: {e}")
