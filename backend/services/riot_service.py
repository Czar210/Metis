"""
riot_service.py — Ponte entre o jogador real e o banco do Metis.

Fluxo:
  1. Riot API (RiotWatcher/LolWatcher) → busca PUUID + últimas partidas ranqueadas
  2. Para cada partida nova → puxa match data + timeline
  3. Camada Prata (process_matches / process_timelines) → limpa e classifica
  4. Supabase → persiste nas tabelas players, matches, match_participants, etc.

Responsabilidades:
  - Orquestrar a ingestão de ponta a ponta para um jogador específico.
  - Retornar um relatório estruturado (quantas novas, quantas ignoradas, erros).
  - NÃO duplicar partidas que já existem no Supabase.
"""

import os
import time
from typing import Any

from riotwatcher import LolWatcher, RiotWatcher, ApiError
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# ── Configurações ─────────────────────────────────────────────
RIOT_API_KEY = os.environ.get("RIOT_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")


def _get_supabase() -> Client:
    """Retorna um client do Supabase (singleton simples)."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _get_routing_region(server: str) -> str:
    """Retorna a routing region da Riot para o servidor fornecido."""
    server = server.upper()
    if server in ["BR1", "NA1", "LA1", "LA2"]:
        return "americas"
    if server in ["EUW1", "EUN1", "TR1", "RU"]:
        return "europe"
    if server in ["KR", "JP1"]:
        return "asia"
    return "sea"


def _match_exists(supabase: Client, match_id: str) -> bool:
    """Checa se a partida já está salva no Supabase."""
    result = supabase.table("matches").select("match_id").eq("match_id", match_id).execute()
    return len(result.data) > 0


# ══════════════════════════════════════════════════════════════
#  CAMADA PRATA — limpeza inline (baseado em process_matches.py)
# ══════════════════════════════════════════════════════════════

def _classificar_tipo_final(info: dict) -> str:
    """Classifica se a partida terminou normal, early_ff ou late_ff."""
    if info.get("gameEndedInEarlySurrender"):
        return "early_ff"
    if info.get("gameEndedInSurrender"):
        return "late_ff"
    return "normal"


def _processar_e_salvar(supabase: Client, match_data: dict) -> dict[str, Any]:
    """
    Aplica a lógica da Camada Prata e insere nas tabelas do Supabase.
    Retorna {"saved": True/False, "reason": "..."}.
    """
    metadata = match_data.get("metadata", {})
    info = match_data.get("info", {})
    match_id = metadata.get("matchId")

    if not match_id or not info:
        return {"saved": False, "reason": "JSON inválido ou corrompido"}

    game_duration = info.get("gameDuration", 0)

    # Filtro anti-ruído: remakes / partidas curtas (< 15 min)
    if game_duration < 900:
        return {"saved": False, "reason": f"Partida muito curta / Remake ({game_duration}s)"}

    end_type = _classificar_tipo_final(info)

    # ── 1. Tabela: matches ────────────────────────────────────
    match_payload = {
        "match_id": match_id,
        "game_version": info.get("gameVersion"),
        "game_duration": game_duration,
        "queue_id": info.get("queueId"),
        "end_type": end_type,
    }
    supabase.table("matches").upsert(match_payload).execute()

    # ── 2. Tabelas: players + match_participants ──────────────
    players_payload = []
    participants_payload = []

    for p in info.get("participants", []):
        puuid = p.get("puuid")

        players_payload.append({
            "puuid": puuid,
            "game_name": p.get("riotIdGameName", "Desconhecido"),
            "tag_line": p.get("riotIdTagline", "UNK"),
        })

        challenges = p.get("challenges", {})
        time_played = p.get("timePlayed", game_duration)
        is_afk = p.get("teamEarlySurrendered", False) or (time_played < (game_duration * 0.8))
        challenges["is_afk"] = is_afk

        participants_payload.append({
            "match_id": match_id,
            "puuid": puuid,
            "champion_name": p.get("championName"),
            "team_position": p.get("teamPosition"),
            "win": p.get("win"),
            "kills": p.get("kills", 0),
            "deaths": p.get("deaths", 0),
            "assists": p.get("assists", 0),
            "gold_earned": p.get("goldEarned", 0),
            "total_damage_dealt_to_champions": p.get("totalDamageDealtToChampions", 0),
            "damage_dealt_to_buildings": p.get("damageDealtToBuildings", 0),
            "total_time_cc_dealt": p.get("totalTimeCCDealt", 0),
            "vision_score": p.get("visionScore", 0),
            "solo_kills": challenges.get("soloKills", 0),
            "damage_per_minute": challenges.get("damagePerMinute", 0.0),
            "kill_participation": challenges.get("killParticipation", 0.0),
            "early_laning_phase_gold_exp_advantage": challenges.get("earlyLaningPhaseGoldExpAdvantage", 0.0),
            "challenges": challenges,
        })

    supabase.table("players").upsert(players_payload).execute()
    supabase.table("match_participants").upsert(participants_payload).execute()

    return {"saved": True, "reason": f"OK ({end_type})"}


# ══════════════════════════════════════════════════════════════
#  FUNÇÃO PRINCIPAL — chamada pela rota
# ══════════════════════════════════════════════════════════════

def atualizar_historico(
    game_name: str,
    tag_line: str,
    server: str,
    count: int = 10,
) -> dict[str, Any]:
    """
    Fluxo completo de atualização do histórico de um jogador:
      Riot API → Camada Prata → Supabase

    Retorna um relatório com o resultado de cada partida.
    """
    if not RIOT_API_KEY:
        raise RuntimeError("RIOT_API_KEY não encontrada no .env")

    riot_watcher = RiotWatcher(RIOT_API_KEY)
    lol_watcher = LolWatcher(RIOT_API_KEY)
    supabase = _get_supabase()
    routing = _get_routing_region(server)

    # ── 1. Buscar PUUID ──────────────────────────────────────
    account = riot_watcher.account.by_riot_id(routing, game_name, tag_line)
    puuid = account["puuid"]

    # Atualiza/cria o jogador com server
    supabase.table("players").upsert({
        "puuid": puuid,
        "game_name": game_name,
        "tag_line": tag_line,
        "server": server,
    }).execute()

    # ── 2. Buscar lista de partidas ranqueadas ────────────────
    match_ids: list[str] = lol_watcher.match.matchlist_by_puuid(
        routing, puuid, count=count, type="ranked"
    )

    if not match_ids:
        return {
            "puuid": puuid,
            "total": 0,
            "novas": 0,
            "ignoradas": 0,
            "erros": 0,
            "detalhes": [],
        }

    # ── 3. Para cada partida: verificar → buscar → limpar → salvar
    detalhes = []
    novas = 0
    ignoradas = 0
    erros = 0

    for match_id in match_ids:
        # Skip se já existe no banco
        if _match_exists(supabase, match_id):
            detalhes.append({"match_id": match_id, "status": "já existe"})
            ignoradas += 1
            continue

        try:
            match_data = lol_watcher.match.by_id(routing, match_id)
            resultado = _processar_e_salvar(supabase, match_data)

            if resultado["saved"]:
                detalhes.append({"match_id": match_id, "status": "salva", "info": resultado["reason"]})
                novas += 1
            else:
                detalhes.append({"match_id": match_id, "status": "descartada", "info": resultado["reason"]})
                ignoradas += 1

            # Respeitar rate limit da Riot (riotwatcher já faz, mas segurança extra)
            time.sleep(1.2)

        except ApiError as err:
            detalhes.append({"match_id": match_id, "status": "erro", "info": str(err)})
            erros += 1
        except Exception as err:
            detalhes.append({"match_id": match_id, "status": "erro", "info": str(err)})
            erros += 1

    return {
        "puuid": puuid,
        "total": len(match_ids),
        "novas": novas,
        "ignoradas": ignoradas,
        "erros": erros,
        "detalhes": detalhes,
    }
