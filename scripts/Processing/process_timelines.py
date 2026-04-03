import os
import json
import gzip
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
            events_payload.append({
                "match_id": match_id,
                "timestamp": event.get("timestamp", 0),
                "event_type": e_type,
                "primary_participant_id": id_to_puuid.get(killer_id) if killer_id else None,
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

    print(f"⏳ Salvando Timeline {match_id} — {len(snapshots_payload)} snapshots, {len(events_payload)} eventos...")

    try:
        if snapshots_payload:
            db_client.table("participant_snapshots").upsert(snapshots_payload).execute()
        if events_payload:
            db_client.table("critical_events").upsert(events_payload).execute()

        print(f"✅ Timeline {match_id} salva com sucesso.")
        return True
    except Exception as e:
        print(f"❌ Erro ao salvar Timeline no Supabase: {e}")
        return False


if __name__ == "__main__":
    caminho_teste = r"C:\Users\cesar\Documents\GitHub\Metis\data\raw\timelines_BR1_2907503741.json.gz"

    if os.path.exists(caminho_teste):
        print(f"📂 Abrindo arquivo: {caminho_teste}")
        try:
            with gzip.open(caminho_teste, "rt", encoding="utf-8") as f:
                timeline_data = json.load(f)
                processar_timeline(timeline_data)
        except Exception as e:
            print(f"❌ Erro ao ler ou decodificar o arquivo: {e}")
    else:
        print(f"⚠️ Arquivo não encontrado: {caminho_teste}")
