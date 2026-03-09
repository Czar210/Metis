import os
import time
from riotwatcher import LolWatcher, RiotWatcher, ApiError
from dotenv import load_dotenv

# Re-exporta utilitários R2 para manter compatibilidade com imports existentes
from scripts.utils.r2_storage import get_r2_client, check_file_exists, compress_and_upload  # noqa: F401

load_dotenv()

# --- Configurações de Ambiente ---
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
RIOT_API_KEY = os.environ.get("RIOT_API_KEY")

def get_routing_region(server):
    server = server.upper()
    if server in ['BR1', 'NA1', 'LA1', 'LA2']: return 'americas'
    if server in ['EUW1', 'EUN1', 'TR1', 'RU']: return 'europe'
    if server in ['KR', 'JP1']: return 'asia'
    return 'sea'

# =========================================================
# 🔗 FUNÇÃO DA API (Usada pelo Backend do Render)
# =========================================================
def fetch_player_matches(game_name, tag_line, server, count=5, s3_client=None):
    """Busca as partidas de um jogador específico para o Backend."""
    if not RIOT_API_KEY:
        print("❌ RIOT_API_KEY não encontrada no .env!")
        return False

    riot_watcher = RiotWatcher(RIOT_API_KEY)
    lol_watcher = LolWatcher(RIOT_API_KEY)
    routing_region = get_routing_region(server)

    try:
        print(f"\n🔍 Buscando PUUID de {game_name}#{tag_line} no servidor {server}...")
        account = riot_watcher.account.by_riot_id(routing_region, game_name, tag_line)
        puuid = account['puuid']

        print(f"✅ PUUID encontrado! Buscando últimas {count} partidas...")
        match_history = lol_watcher.match.matchlist_by_puuid(
            routing_region, puuid, count=count, type="ranked"
        )

        if not match_history:
            print("🤷‍♂️ Nenhuma partida ranqueada encontrada.")
            return True

        for index, match_id in enumerate(match_history, start=1):
            if check_file_exists(s3_client, "matches", match_id):
                print(f"  ⏭️ Partida {match_id} já existe no R2. Pulando.")
                continue

            match_data = lol_watcher.match.by_id(routing_region, match_id)
            compress_and_upload(match_data, "matches", match_id, s3_client)

            timeline_data = lol_watcher.match.timeline_by_match(routing_region, match_id)
            compress_and_upload(timeline_data, "timelines", match_id, s3_client)
            time.sleep(1.5)

        return True

    except ApiError as err:
        if err.response.status_code == 429:
            print("⚠️ Rate Limit da Riot atingido!")
        elif err.response.status_code == 404:
            print("❌ Jogador ou partida não encontrados.")
        else:
            print(f"❌ Erro na Riot API: {err}")
        return False
