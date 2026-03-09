import os
import json
import gzip
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

R2_ACCOUNT_ID = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")


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
    if not s3_client:
        return False
    file_key = f"{folder}/{match_id}.json.gz"
    try:
        s3_client.head_object(Bucket=BUCKET_NAME, Key=file_key)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            return False
        return False


def compress_and_upload(data_dict, folder, match_id, s3_client):
    if not s3_client:
        return
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
