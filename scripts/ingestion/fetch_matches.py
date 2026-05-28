import logging
import os
import time
from riotwatcher import LolWatcher, RiotWatcher, ApiError
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Re-exporta utilitrios R2 para manter compatibilidade com imports existentes
from scripts.utils.r2_storage import get_r2_client, check_file_exists, compress_and_upload  # noqa: F401

load_dotenv()

# --- Configuraes de Ambiente ---
BUCKET_NAME = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
RIOT_API_KEY = os.environ.get("RIOT_API_KEY")

def get_routing_region(server):
    server = server.upper()
    if server in ['BR1', 'NA1', 'LA1', 'LA2']: return 'americas'
    if server in ['EUW1', 'EUN1', 'TR1', 'RU']: return 'europe'
    if server in ['KR', 'JP1']: return 'asia'
    return 'sea'

# =========================================================
#  FUNO DA API (Usada pelo Backend do Render)
# =========================================================
def fetch_player_matches(game_name, tag_line, server, count=5, s3_client=None):
    """Busca as partidas de um jogador especfico para o Backend."""
    if not RIOT_API_KEY:
        logger.error("RIOT_API_KEY no encontrada no .env")
        return {"status": "error", "error": "RIOT_API_KEY no encontrada no .env!"}

    if tag_line.startswith("#"):
        tag_line = tag_line[1:]

    riot_watcher = RiotWatcher(RIOT_API_KEY)
    lol_watcher = LolWatcher(RIOT_API_KEY)
    routing_region = get_routing_region(server)

    try:
        logger.info("Buscando PUUID de %s#%s no servidor %s", game_name, tag_line, server)
        account = riot_watcher.account.by_riot_id(routing_region, game_name, tag_line)
        puuid = account['puuid']

        logger.info("PUUID encontrado  buscando ltimas %d partidas", count)
        match_history = lol_watcher.match.matchlist_by_puuid(
            routing_region, puuid, count=count, type="ranked"
        )

        if not match_history:
            logger.info("Nenhuma partida ranqueada encontrada")
            return {"status": "success", "message": "Nenhuma partida ranqueada encontrada."}

        for index, match_id in enumerate(match_history, start=1):
            if check_file_exists(s3_client, "matches", match_id):
                logger.debug("Partida %s j existe no R2, pulando", match_id)
                continue

            match_data = lol_watcher.match.by_id(routing_region, match_id)
            if not compress_and_upload(match_data, "matches", match_id, s3_client):
                logger.warning("Falha no upload de match %s, pulando timeline", match_id)
                continue

            timeline_data = lol_watcher.match.timeline_by_match(routing_region, match_id)
            if not compress_and_upload(timeline_data, "timelines", match_id, s3_client):
                logger.warning("Falha no upload de timeline %s", match_id)
            time.sleep(1.5)

        return {"status": "success", "message": f"{len(match_history)} partidas processadas com sucesso."}

    except ApiError as err:
        if err.response.status_code == 429:
            logger.warning("Rate Limit da Riot atingido")
            error_msg = "Rate Limit da Riot atingido!"
        elif err.response.status_code == 404:
            logger.warning("Jogador ou partida no encontrados")
            error_msg = "Jogador ou partida no encontrados."
        elif err.response.status_code == 403:
            logger.error("Riot API Key expirada ou invlida")
            error_msg = "Riot API Key expirada ou invlida."
        else:
            logger.error("Erro na Riot API: %s", err)
            error_msg = f"Erro na Riot API: {err}"
        return {"status": "error", "error": error_msg}
