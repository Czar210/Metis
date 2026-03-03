import os
import json
import gzip
import polars as pl
from supabase import create_client, Client
from dotenv import load_dotenv

# Carrega as variáveis de ambiente
load_dotenv()

# --- Conexões ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def processar_partida_base(match_json_data):
    """
    Processa o JSON bruto da Camada Bronze e insere nas tabelas 'matches' e 'match_participants'.
    """
    metadata = match_json_data.get("metadata", {})
    info = match_json_data.get("info", {})

    match_id = metadata.get("matchId")
    if not match_id or not info:
        print("⚠️ Partida inválida ou corrompida. Ignorando.")
        return False

    game_duration = info.get("gameDuration", 0)

    # ---------------------------------------------------------
    # 1. LÓGICA DE LIMPEZA E CLASSIFICAÇÃO DA PARTIDA
    # ---------------------------------------------------------
    # Filtro anti-ruído pesado: Partidas com menos de 3 minutos são descartadas sumariamente
    if game_duration < 190:
        print(f"⏭️ {match_id}: Remake/Queda de servidor ignorado (Duração: {game_duration}s).")
        return False

    end_type = "normal"
    if info.get("gameEndedInEarlySurrender"):
        end_type = "early_ff"
    elif info.get("gameEndedInSurrender"):
        # Se teve surrender, mas não foi early, é late_ff
        end_type = "late_ff"

    # Preparando payload para a tabela 'matches'
    match_payload = {
        "match_id": match_id,
        "game_version": info.get("gameVersion"),
        "game_duration": game_duration,
        "queue_id": info.get("queueId"),
        "end_type": end_type
    }

    # Inserindo/Atualizando a partida
    supabase.table("matches").upsert(match_payload).execute()

    # ---------------------------------------------------------
    # 2. PROCESSAMENTO DOS PARTICIPANTES
    # ---------------------------------------------------------
    participants = info.get("participants", [])
    participants_payload = []

    for p in participants:
        # A) Lógica para identificar Quitters / AFK
        # O cara jogou menos de 80% do tempo total da partida? Provável AFK.
        time_played = p.get("timePlayed", game_duration)
        is_afk = p.get("teamEarlySurrendered", False) or (time_played < (game_duration * 0.8))

        # B) Extração do "Cofre" (Challenges)
        challenges = p.get("challenges", {})

        # C) Montagem da linha do jogador
        participant_data = {
            "match_id": match_id,
            "puuid": p.get("puuid"),
            "champion_name": p.get("championName"),
            "team_position": p.get("teamPosition"),
            "win": p.get("win"),
            "is_afk": is_afk, # Nova métrica salva

            # KDA e Economia
            "kills": p.get("kills", 0),
            "deaths": p.get("deaths", 0),
            "assists": p.get("assists", 0),
            "gold_earned": p.get("goldEarned", 0),

            # Combate e Objetivos
            "total_damage_dealt_to_champions": p.get("totalDamageDealtToChampions", 0),
            "damage_dealt_to_buildings": p.get("damageDealtToBuildings", 0),
            "total_time_cc_dealt": p.get("totalTimeCCDealt", 0),
            "vision_score": p.get("visionScore", 0),

            # Dados avançados dos Challenges
            "solo_kills": challenges.get("soloKills", 0),
            "damage_per_minute": challenges.get("damagePerMinute", 0.0),
            "kill_participation": challenges.get("killParticipation", 0.0),
            "early_laning_phase_gold_exp_advantage": challenges.get("earlyLaningPhaseGoldExpAdvantage", 0.0),

            # O Cofre Completo em formato JSONB para a IA buscar o que quiser no futuro
            "challenges": challenges
        }
        participants_payload.append(participant_data)

    # Inserção em massa (Bulk Insert) para os 10 jogadores de uma vez só!
    supabase.table("match_participants").upsert(participants_payload).execute()

    print(f"✅ {match_id}: Processada com sucesso! (Tipo: {end_type})")
    return True

# --- Código de Teste (Simulando a leitura do R2) ---
if __name__ == "__main__":
    # Aqui, futuramente, você fará um loop baixando do R2 com o boto3
    # Por enquanto, se você tiver um arquivo baixado localmente para teste:
    caminho_teste = "caminho/para/uma/partida_de_teste.json.gz"

    if os.path.exists(caminho_teste):
        with gzip.open(caminho_teste, 'rt', encoding='utf-8') as f:
            match_data = json.load(f)
            processar_partida_base(match_data)
    else:
        print("Arquivo de teste não encontrado. Pronto para ser plugado no fluxo do R2.")
