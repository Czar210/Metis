import os
import json
import gzip
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: Credenciais do Supabase não encontradas no arquivo .env!")

supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_KEY or "")

def processar_timeline(timeline_json_data):
    """
    Lê a Timeline da Riot, extrai fotografias aos 10, 15 e 20 min,
    e mapeia eventos críticos (Abates e Objetivos).
    """
    metadata = timeline_json_data.get("metadata", {})
    info = timeline_json_data.get("info", {})

    match_id = metadata.get("matchId")
    if not match_id or not info:
        print("⚠️ Timeline inválida ou corrompida. Ignorando.")
        return False

    # 1. O Tradutor: A Riot usa IDs de 1 a 10 nos eventos da Timeline.
    # Precisamos mapear quem é o ID 1, quem é o ID 2 para o PUUID real do banco.
    participants = info.get("participants", [])
    id_to_puuid = {p["participantId"]: p["puuid"] for p in participants}

    frames = info.get("frames", [])

    snapshots_payload = []
    events_payload = []

    print(f"⏳ Processando {len(frames)} frames da Timeline para a partida {match_id}...")

    for frame in frames:
        timestamp_ms = frame.get("timestamp", 0)
        # Converte milissegundos para minutos inteiros (ex: 600000ms = 10min)
        minute = timestamp_ms // 60000

        # ---------------------------------------------------------
        # A) FOTOGRAFIAS TEMPORAIS (10, 15, 20 Minutos)
        # ---------------------------------------------------------
        if minute in [10, 15, 20]:
            participant_frames = frame.get("participantFrames", {})

            for p_id_str, p_data in participant_frames.items():
                p_id = int(p_id_str)
                puuid = id_to_puuid.get(p_id)
                damage_stats = p_data.get("damageStats", {})

                snapshots_payload.append({
                    "match_id": match_id,
                    "puuid": puuid,
                    "timestamp_minute": minute,
                    "level": p_data.get("level", 0),
                    "total_gold": p_data.get("totalGold", 0),
                    "minions_killed": p_data.get("minionsKilled", 0),
                    "jungle_minions_killed": p_data.get("jungleMinionsKilled", 0),
                    "champion_damage_done": damage_stats.get("totalDamageDoneToChampions", 0)
                    # csd_15 e gd_15 (diferenças) serão calculados depois pela IA ou em Views do BD
                })

        # ---------------------------------------------------------
        # B) EVENTOS CRÍTICOS (Heatmap e Objetivos)
        # ---------------------------------------------------------
        events = frame.get("events", [])
        for event in events:
            e_type = event.get("type")

            # Filtramos apenas o que importa (ignora comprar item, upar skill, etc)
            if e_type in ["CHAMPION_KILL", "ELITE_MONSTER_KILL", "BUILDING_KILL"]:
                killer_id = event.get("killerId")

                # Se o killer for 0, foi executado (Torre/Minion matou)
                primary_puuid = id_to_puuid.get(killer_id) if killer_id else None
                position = event.get("position", {})

                events_payload.append({
                    "match_id": match_id,
                    "timestamp": event.get("timestamp", 0),
                    "event_type": e_type,
                    "primary_participant_id": primary_puuid,
                    "position_x": position.get("x"),
                    "position_y": position.get("y")
                })

    try:
        # Inserindo Snapshots (Serão 30 linhas no total: 10 jogadores * 3 minutos)
        if snapshots_payload:
            supabase.table("participant_snapshots").upsert(snapshots_payload).execute()

        # Inserindo Eventos (Varia por partida, geralmente de 30 a 100 linhas)
        if events_payload:
            supabase.table("critical_events").upsert(events_payload).execute()

        print(f"✅ Timeline de {match_id} salva! ({len(snapshots_payload)} Snapshots, {len(events_payload)} Eventos).")
        return True
    except Exception as e:
        print(f"❌ Erro ao salvar Timeline no Supabase: {e}")
        return False

# --- Código de Teste ---
if __name__ == "__main__":
    # COLOQUE AQUI O CAMINHO DO SEU ARQUIVO TIMELINES (Começa com "timelines_BR1...")
    caminho_teste = r"C:\Users\cesar\Documents\GitHub\Metis\data\raw\timelines_BR1_2907503741.json.gz"

    if os.path.exists(caminho_teste):
        print(f"📂 Abrindo arquivo: {caminho_teste}")
        try:
            with gzip.open(caminho_teste, 'rt', encoding='utf-8') as f:
                timeline_data = json.load(f)
                processar_timeline(timeline_data)
        except Exception as e:
            print(f"❌ Erro ao ler ou decodificar o arquivo: {e}")
    else:
        print(f"⚠️ O arquivo {caminho_teste} não foi encontrado.")
