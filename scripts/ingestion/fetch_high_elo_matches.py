import os
import time
import boto3
from riotwatcher import LolWatcher, ApiError
from dotenv import load_dotenv

# Importando as ferramentas de infra que já validamos
from scripts.ingestion.fetch_matches import (
    get_r2_client,
    get_routing_region,
    check_file_exists,
    compress_and_upload
)

load_dotenv()

RIOT_API_KEY = os.environ.get("RIOT_API_KEY")

def fetch_high_elo_sequential(server, target_per_tier=250):
    """
    Trator de Ingestão: Percorre a elite do servidor, baixando
    exatamente X partidas para CADA elo, do Challenger ao Diamante 4.
    """
    if not RIOT_API_KEY:
        print("❌ RIOT_API_KEY não configurada.")
        return

    lol_watcher = LolWatcher(RIOT_API_KEY)
    s3 = get_r2_client()
    region = get_routing_region(server)

    # Adicionamos D3 e D4 para garantir a cobertura completa do High Elo
    tiers_to_scan = [
        ('CHALLENGER', None),
        ('GRANDMASTER', None),
        ('MASTER', None),
        ('DIAMOND', 'I'),
        ('DIAMOND', 'II'),
        ('DIAMOND', 'III'),
        ('DIAMOND', 'IV')
    ]

    matches_global = 0

    print(f"🚀 Iniciando Varredura Pesada em {server} | Meta: {target_per_tier} partidas POR ELO.")

    for tier, division in tiers_to_scan:
        tier_matches = 0 # Reseta o contador para o novo Elo!
        nome_elo = f"{tier} {division if division else ''}".strip()

        print(f"\n==================================================")
        print(f"📂 Escavando Camada: {nome_elo}")
        print(f"==================================================")

        try:
            # Coleta a lista completa do Tier
            if tier == 'CHALLENGER':
                league_data = lol_watcher.league.challenger_by_queue(server, 'RANKED_SOLO_5x5')
                players = league_data['entries']
            elif tier == 'GRANDMASTER':
                league_data = lol_watcher.league.grandmaster_by_queue(server, 'RANKED_SOLO_5x5')
                players = league_data['entries']
            elif tier == 'MASTER':
                league_data = lol_watcher.league.masters_by_queue(server, 'RANKED_SOLO_5x5')
                players = league_data['entries']
            else:
                players = lol_watcher.league.entries(server, 'RANKED_SOLO_5x5', tier, division)

            print(f"✅ Lista obtida! {len(players)} jogadores em {nome_elo}.")

            for idx, player in enumerate(players):
                # A grande mudança: A trava agora é por ELO!
                if tier_matches >= target_per_tier:
                    print(f"\n🎯 Meta de {target_per_tier} atingida para {nome_elo}! Avançando...")
                    break

                s_id = player.get('summonerId')
                puuid = player.get('puuid')

                if not s_id and not puuid:
                    continue

                try:
                    print(f"[{tier_matches}/{target_per_tier}] Analisando jogador {idx+1}/{len(players)}... ", end="\r")

                    if not puuid and s_id:
                        summoner_info = lol_watcher.summoner.by_id(server, s_id)
                        puuid = summoner_info['puuid']
                        time.sleep(1)

                    match_ids = lol_watcher.match.matchlist_by_puuid(region, puuid, count=3, type="ranked")

                    for m_id in match_ids:
                        if tier_matches >= target_per_tier: break

                        if check_file_exists(s3, "matches", m_id):
                            continue

                        m_data = lol_watcher.match.by_id(region, m_id)
                        compress_and_upload(m_data, "matches", m_id, s3)

                        t_data = lol_watcher.match.timeline_by_match(region, m_id)
                        compress_and_upload(t_data, "timelines", m_id, s3)

                        tier_matches += 1
                        matches_global += 1
                        time.sleep(1.2)

                except ApiError as e:
                    if e.response.status_code == 429:
                        wait = int(e.response.headers.get('Retry-After', 10))
                        print(f"\n⚠️ Limite de requisições! Pausando por {wait} segundos...")
                        time.sleep(wait)
                    continue
                except Exception as e:
                    continue

        except ApiError as err:
            print(f"\n❌ Erro ao acessar a liga {nome_elo}: {err}")

    print(f"\n✨ Varredura finalizada no servidor {server}. Total geral: {matches_global} partidas injetadas.")

if __name__ == "__main__":
    import time

    # Configuração Global
    servidores_alvo = ["BR1", "KR", "EUW1", "NA1"]
    meta_por_elo = 250  # <-- 250 por cada um dos 7 elos!

    print(f"🌍 Iniciando Varredura Global da Metis...")

    for servidor in servidores_alvo:
        fetch_high_elo_sequential(servidor, target_per_tier=meta_por_elo)
        time.sleep(5)

    print("\n🌐 Missão Global Concluída com Sucesso!")
