import os
import json
import gzip
import io
import logging
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")


def extrair_dados_timeline(timeline_json_data: dict) -> tuple[str | None, list, list]:
    """
    Parsing puro da Timeline da Riot — sem I/O, sem banco.
    Extrai fotografias temporais (10, 15, 20 min) e eventos críticos.

    Retorna:
        match_id: str | None
        snapshots: list[dict]  — linhas para a tabela participant_snapshots
        events:   list[dict]   — linhas para a tabela critical_events
    """
    metadata = timeline_json_data.get("metadata", {})
    info = timeline_json_data.get("info", {})

    match_id = metadata.get("matchId")
    if not match_id or not info:
        return None, [], []

    participants = info.get("participants", [])
    id_to_puuid = {p["participantId"]: p["puuid"] for p in participants}

    frames = info.get("frames", [])
    snapshots_payload = []
    events_payload = []

    for frame in frames:
        timestamp_ms = frame.get("timestamp", 0)
        minute = timestamp_ms // 60000

        # Fotografias temporais aos 10, 15 e 20 minutos
        if minute in [10, 15, 20]:
            for p_id_str, p_data in frame.get("participantFrames", {}).items():
                p_id = int(p_id_str)
                damage_stats = p_data.get("damageStats", {})
                snapshots_payload.append({
                    "match_id": match_id,
                    "puuid": id_to_puuid.get(p_id),
                    "timestamp_minute": minute,
                    "level": p_data.get("level", 0),
                    "total_gold": p_data.get("totalGold", 0),
                    "minions_killed": p_data.get("minionsKilled", 0),
                    "jungle_minions_killed": p_data.get("jungleMinionsKilled", 0),
                    "champion_damage_done": damage_stats.get("totalDamageDoneToChampions", 0),
                })

        # Eventos críticos (Abates, Objetivos, Torres)
        for event in frame.get("events", []):
            e_type = event.get("type")
            if e_type not in ["CHAMPION_KILL", "ELITE_MONSTER_KILL", "BUILDING_KILL"]:
                continue
            killer_id = event.get("killerId")
            position = event.get("position", {})

            secondary_participant_id = None
            assisting_participant_ids = None
            details = None

            if e_type == "CHAMPION_KILL":
                victim_id = event.get("victimId")
                secondary_participant_id = id_to_puuid.get(victim_id) if victim_id else None
                assist_ids = event.get("assistingParticipantIds", [])
                assisting_participant_ids = [
                    id_to_puuid[a] for a in assist_ids if a in id_to_puuid
                ] or None

            elif e_type == "ELITE_MONSTER_KILL":
                details = {
                    "monsterType": event.get("monsterType"),
                    "monsterSubType": event.get("monsterSubType"),
                }

            elif e_type == "BUILDING_KILL":
                details = {
                    "buildingType": event.get("buildingType"),
                    "laneType": event.get("laneType"),
                    "towerType": event.get("towerType"),
                    "teamId": event.get("teamId"),
                }

            events_payload.append({
                "match_id": match_id,
                "timestamp": event.get("timestamp", 0),
                "event_type": e_type,
                "primary_participant_id": id_to_puuid.get(killer_id) if killer_id else None,
                "secondary_participant_id": secondary_participant_id,
                "assisting_participant_ids": assisting_participant_ids,
                "details": details,
                "position_x": position.get("x"),
                "position_y": position.get("y"),
            })

    return match_id, snapshots_payload, events_payload


def processar_timeline(timeline_json_data: dict, db_client=None) -> bool:
    """
    Persiste a Timeline processada no Supabase.

    Args:
        timeline_json_data: JSON bruto da Riot Timeline API.
        db_client: cliente Supabase injetável (facilita testes com mock).
                   Se None, cria o cliente real usando variáveis de ambiente.
    """
    match_id, snapshots_payload, events_payload = extrair_dados_timeline(timeline_json_data)

    if not match_id:
        print("⚠️ Timeline inválida ou corrompida. Ignorando.")
        return False

    if db_client is None:
        from supabase import create_client
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("❌ ERRO: Credenciais do Supabase não encontradas no .env!")
            return False
        db_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    logging.getLogger(__name__).debug(f"Timeline {match_id}: {len(snapshots_payload)} snapshots, {len(events_payload)} eventos")

    try:
        if snapshots_payload:
            db_client.table("participant_snapshots").upsert(
                snapshots_payload, on_conflict="match_id,puuid,timestamp_minute"
            ).execute()
        if events_payload:
            # critical_events nao tem unique constraint — deletar antes e reinserir
            db_client.table("critical_events").delete().eq("match_id", match_id).execute()
            db_client.table("critical_events").insert(events_payload).execute()

        return True
    except Exception as e:
        logging.getLogger(__name__).error(f"Timeline {match_id}: {e}")
        return False


BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 50))


def _get_processed_timeline_ids(db_client) -> set:
    """Retorna match_ids de timelines já processadas, com paginação completa."""
    try:
        ids: set[str] = set()
        page_size = 1000
        offset = 0
        while True:
            result = (
                db_client.table("processed_timelines")
                .select("match_id")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            batch = result.data or []
            for row in batch:
                ids.add(row["match_id"])
            if len(batch) < page_size:
                break
            offset += page_size
        return ids
    except Exception as e:
        print(f"⚠️  Não foi possível buscar processed_timelines: {e}")
        return set()


def _marcar_timeline_processada(db_client, match_id: str) -> None:
    try:
        db_client.table("processed_timelines").upsert({"match_id": match_id}).execute()
    except Exception as e:
        print(f"⚠️  Falha ao marcar timeline {match_id} como processada: {e}")


def _listar_keys_r2(s3_client, bucket: str) -> list[str]:
    keys = []
    paginator = s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix="timelines/"):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


def _baixar_e_descomprimir(s3_client, bucket: str, key: str) -> dict | None:
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        compressed = response["Body"].read()
        with gzip.open(io.BytesIO(compressed), "rt", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Falha ao baixar {key}: {e}")
        return None


def rodar_pipeline_timelines(s3_client=None, db_client=None, batch_size: int = BATCH_SIZE) -> dict:
    """
    Loop Bronze → Prata para timelines.
    Lista timelines do R2, filtra as já processadas, processa em batch.
    Só processa timelines cujas partidas já estão na tabela processed_matches
    (garante que match + timeline ficam em sincronia na camada Prata).
    """
    from scripts.utils.r2_storage import get_r2_client
    from supabase import create_client

    if s3_client is None:
        s3_client = get_r2_client()
    if s3_client is None:
        print("❌ R2 client não disponível.")
        return {"processadas": 0, "descartadas": 0, "erros": 0}

    if db_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("❌ Credenciais do Supabase não encontradas.")
            return {"processadas": 0, "descartadas": 0, "erros": 0}
        db_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

    print("📋 Buscando timelines já processadas...")
    processed_ids = _get_processed_timeline_ids(db_client)
    print(f"   {len(processed_ids)} timelines já processadas.")

    print("📦 Listando timelines no R2...")
    all_keys = _listar_keys_r2(s3_client, bucket)
    print(f"   {len(all_keys)} arquivos encontrados.")

    pendentes = [
        k for k in all_keys
        if k.replace("timelines/", "").replace(".json.gz", "") not in processed_ids
    ]
    print(f"   {len(pendentes)} pendentes. Processando batch de {batch_size}...")

    batch = pendentes[:batch_size]
    stats = {"processadas": 0, "descartadas": 0, "erros": 0}

    for i, key in enumerate(batch, 1):
        match_id = key.replace("timelines/", "").replace(".json.gz", "")
        print(f"[{i}/{len(batch)}] {match_id}", end=" — ")

        timeline_json = _baixar_e_descomprimir(s3_client, bucket, key)
        if timeline_json is None:
            stats["erros"] += 1
            _marcar_timeline_processada(db_client, match_id)
            continue

        ok = processar_timeline(timeline_json, db_client=db_client)
        if ok:
            stats["processadas"] += 1
        else:
            stats["descartadas"] += 1

        _marcar_timeline_processada(db_client, match_id)

    print(f"\n📊 Resultado: {stats}")
    return stats


if __name__ == "__main__":
    rodar_pipeline_timelines()
