import os
import time
import random
from concurrent.futures import ThreadPoolExecutor
from riotwatcher import LolWatcher, ApiError
from dotenv import load_dotenv

# Importando as ferramentas do nosso arquivo base!
from scripts.ingestion.fetch_matches import (
    get_r2_client,
    get_routing_region,
    check_file_exists,
    compress_and_upload
)

load_dotenv()
RIOT_API_KEY = os.environ.get("RIOT_API_KEY")

MAX_WORKERS = 5
RATE_LIMIT_PAUSE = 120

def get_league_data(lol_watcher, server, tier):
    """Tenta obter a lista de jogadores com retentativas para evitar o erro do Master."""
    for tentativa in range(3):
        try:
            if tier == 'CHALLENGER': return lol_watcher.league.challenger_by_queue(server, 'RANKED_SOLO_5x5')
            if tier == 'GRANDMASTER': return lol_watcher.league.grandmaster_by_queue(server, 'RANKED_SOLO_5x5')
            if tier == 'MASTER': return lol_watcher.league.masters_by_queue(server, 'RANKED_SOLO_5x5')
            if tier == 'DIAMOND': return lol_watcher.league.entries_by_rank(server, 'RANKED_SOLO_5x5', 'DIAMOND', 'I')
        except Exception as e:
            print(f"⚠️ Tentativa {tentativa+1} para {tier} falhou. Retentando...")
            time.sleep(5)
    return None

def process_single_match(match_id, routing_region, lol_watcher, s3_client):
    """Executa o download e upload de uma única partida."""
    if check_file_exists(s3_client, "matches", match_id):
        return "EXISTE"
    try:
        m_data = lol_watcher.match.by_id(routing_region, match_id)
        compress_and_upload(m_data, "matches", match_id, s3_client)

        t_data = lol_watcher.match.timeline_by_match(routing_region, match_id)
        compress_and_upload(t_data, "timelines", match_id, s3_client)
        return "SUCESSO"
    except ApiError as e:
        if e.response.status_code == 429: return "LIMIT"
        return "ERRO"

def fetch_high_elo_turbo(server, target_per_tier=250):
    print(f"🌍 Iniciando Varredura Turbo em {server}...")
    lol_watcher = LolWatcher(RIOT_API_KEY)
    s3 = get_r2_client()
    routing_region = get_routing_region(server)

    tiers = ['CHALLENGER', 'GRANDMASTER', 'MASTER', 'DIAMOND']

    for tier in tiers:
        print(f"\n--- Camada: {tier} ---")
        data = get_league_data(lol_watcher, server, tier)
        if not data: continue

        entries = data['entries'] if isinstance(data, dict) else data
        random.shuffle(entries)

        coletadas = 0
        idx = 0

        while coletadas < target_per_tier and idx < len(entries):
            player = entries[idx]
            s_id = player.get('summonerId') or player.get('summonerId')
            if not s_id and 'summonerName' in player: s_id = player['summonerName']

            try:
                summ = lol_watcher.summoner.by_id(server, s_id)
                m_list = lol_watcher.match.matchlist_by_puuid(routing_region, summ['puuid'], count=3, type="ranked")

                with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                    results = list(executor.map(lambda mid: process_single_match(mid, routing_region, lol_watcher, s3), m_list))

                novas = results.count("SUCESSO")
                coletadas += novas
                print(f"✅ [{coletadas}/{target_per_tier}] Jogador {idx+1}: +{novas} partidas.")

                if "LIMIT" in results:
                    print(f"⏳ Rate Limit! Pausando {RATE_LIMIT_PAUSE}s...")
                    time.sleep(RATE_LIMIT_PAUSE)
            except Exception:
                pass

            idx += 1
            time.sleep(0.4)

if __name__ == "__main__":
    fetch_high_elo_turbo("BR1", target_per_tier=250)
