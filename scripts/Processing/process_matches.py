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

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: Credenciais do Supabase não encontradas no arquivo .env!")

supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_KEY or "")

def processar_partida_base(match_json_data):
    """
    Processa o JSON bruto da Camada Bronze e insere nas tabelas 'players', 'matches' e 'match_participants'.
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
        end_type = "late_ff"

    match_payload = {
        "match_id": match_id,
        "game_version": info.get("gameVersion"),
        "game_duration": game_duration,
        "queue_id": info.get("queueId"),
        "end_type": end_type
    }

    try:
        # Inserindo/Atualizando a partida (Tabela Pai)
        supabase.table("matches").upsert(match_payload).execute()
    except Exception as e:
        print(f"❌ Erro ao inserir partida {match_id}: {e}")
        return False

    # ---------------------------------------------------------
    # 2. PROCESSAMENTO DOS JOGADORES E PARTICIPANTES
    # ---------------------------------------------------------
    participants = info.get("participants", [])

    players_payload = []
    participants_payload = []

    for p in participants:
        puuid = p.get("puuid")

        # --- A) Garantir que o Jogador existe no Banco ---
        # Salvamos o jogador ANTES para não dar erro de Foreign Key
        players_payload.append({
            "puuid": puuid,
            "game_name": p.get("riotIdGameName", "Desconhecido"),
            "tag_line": p.get("riotIdTagline", "UNK")
            # server e tier nós atualizamos em outros scripts
        })

        # --- B) Lógica de AFK e Extração ---
        time_played = p.get("timePlayed", game_duration)
        is_afk = p.get("teamEarlySurrendered", False) or (time_played < (game_duration * 0.8))
        challenges = p.get("challenges", {})

        # O PULO DO GATO: Guardamos o is_afk dentro do dicionário JSONB!
        # Assim mantemos a tabela limpa, mas a informação continua salva pro modelo de IA.
        challenges["is_afk"] = is_afk

        # --- C) Montagem da linha do Participante ---
        participant_data = {
            "match_id": match_id,
            "puuid": puuid,
            "champion_name": p.get("championName"),
            "team_position": p.get("teamPosition"),
            "win": p.get("win"),

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

            # O Cofre (O Supabase lida com o JSONB e vai armazenar nosso 'is_afk' aqui dentro)
            "challenges": challenges
        }
        participants_payload.append(participant_data)

    try:
        # 1º BULK INSERT: Cadastra ou atualiza os 10 jogadores no banco
        supabase.table("players").upsert(players_payload).execute()

        # 2º BULK INSERT: Agora sim inserimos as estatísticas da partida!
        supabase.table("match_participants").upsert(participants_payload).execute()

        print(f"✅ {match_id}: Processada com sucesso! (Tipo: {end_type})")
        return True
    except Exception as e:
        print(f"❌ Erro ao inserir participantes da partida {match_id}: {e}")
        return False

# --- Código de Teste ---
if __name__ == "__main__":
    # Caminho base usando Raw String (r"") para evitar problemas no Windows
    caminho_teste = r"C:\Users\cesar\Documents\GitHub\Metis\data\raw\matches_BR1_2907503741.json.gz"

    if os.path.exists(caminho_teste):
        print(f"📂 Abrindo arquivo: {caminho_teste}")
        try:
            with gzip.open(caminho_teste, 'rt', encoding='utf-8') as f:
                match_data = json.load(f)
                processar_partida_base(match_data)
        except Exception as e:
            print(f"❌ Erro ao ler ou decodificar o arquivo: {e}")
    else:
        print(f"⚠️ O arquivo {caminho_teste} não foi encontrado.")
        print("Certifique-se de que o caminho aponta para um .json.gz válido de Matches na sua máquina local.")
