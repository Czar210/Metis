"""
riot_service.py — Ponte entre o jogador real e o banco do Metis.

Fluxo:
  1. Riot API (RiotWatcher/LolWatcher) → busca PUUID + ícone de perfil + últimas partidas (todas as filas)
  2. Para cada partida nova → puxa match data + timeline
  3. Camada Prata (process_matches / process_timelines) → limpa e classifica
  4. Supabase → persiste nas tabelas players, matches, match_participants, etc.

Responsabilidades:
  - Orquestrar a ingestão de ponta a ponta para um jogador específico.
  - Retornar um relatório estruturado (quantas novas, quantas ignoradas, erros).
  - NÃO duplicar partidas que já existem no Supabase.
"""

import json
import os
import time
from datetime import datetime, timezone
from typing import Any

from riotwatcher import LolWatcher, RiotWatcher, ApiError
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SYNC_COOLDOWN_SECONDS = 300  # 5 minutos entre sincronizações por jogador


class SyncCooldownError(Exception):
    """Levantada quando uma sincronização é solicitada antes do cooldown expirar."""
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Cooldown ativo — aguarde {retry_after}s")


def _normalizar_patch(game_version: str) -> str:
    """'14.10.123.456' → '14.10'"""
    parts = (game_version or "").split(".")
    if len(parts) >= 2:
        return f"{parts[0]}.{parts[1]}"
    return game_version or "unknown"

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
    if server in ["OC1", "PH2", "SG2", "TH2", "TW2", "VN2"]:
        return "sea"
    raise ValueError(f"Servidor desconhecido: '{server}'. Valores válidos: BR1, NA1, LA1, LA2, EUW1, EUN1, TR1, RU, KR, JP1, OC1, PH2, SG2, TH2, TW2, VN2")


def _match_exists(supabase: Client, match_id: str) -> bool:
    """Checa se a partida já foi processada (clean ou dirty)."""
    clean = supabase.table("matches").select("match_id").eq("match_id", match_id).limit(1).execute()
    if clean and clean.data:
        return True
    dirty = supabase.table("matches_dirty").select("match_id").eq("match_id", match_id).limit(1).execute()
    return bool(dirty and dirty.data)


# ══════════════════════════════════════════════════════════════
#  CAMADA PRATA — limpeza inline (baseado em process_matches.py)
# ══════════════════════════════════════════════════════════════

# Filas ranqueadas aceitas: SoloQ (420) e Flex (440)
# ── Champion ID → Name map (lazy loaded do JSON estatico) ────────────────────

_champion_id_map: dict[int, str] | None = None

def _get_champion_id_map() -> dict[int, str]:
    global _champion_id_map
    if _champion_id_map is not None:
        return _champion_id_map
    try:
        path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "static", "champion.json")
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        data = raw.get("data", raw)
        _champion_id_map = {int(v["key"]): v["id"] for v in data.values() if "key" in v}
    except Exception as e:
        logger.warning(f"[bans] Erro ao carregar champion.json: {e}")
        _champion_id_map = {}
    return _champion_id_map


RANKED_QUEUE_IDS = {420, 440}

import logging
logger = logging.getLogger(__name__)


def _classificar_tipo_final(info: dict) -> str:
    """Classifica se a partida terminou normal, early_ff ou late_ff."""
    if info.get("gameEndedInEarlySurrender"):
        return "early_ff"
    if info.get("gameEndedInSurrender"):
        return "late_ff"
    return "normal"


def _salvar_dirty(supabase: Client, match_id: str | None, info: dict, reason: str) -> None:
    """Registra partida descartada em matches_dirty para rastreabilidade."""
    try:
        supabase.table("matches_dirty").insert({
            "match_id": match_id,
            "reason": reason,
            "queue_id": info.get("queueId"),
            "game_duration": info.get("gameDuration"),
            "game_version": _normalizar_patch(info.get("gameVersion", "")),
            "raw_info": {
                "gameMode": info.get("gameMode"),
                "gameType": info.get("gameType"),
                "queueId": info.get("queueId"),
                "gameDuration": info.get("gameDuration"),
            },
        }).execute()
    except Exception as e:
        logger.warning(f"Não foi possível salvar em matches_dirty: {e}")


def _processar_e_salvar(supabase: Client, match_data: dict) -> dict[str, Any]:
    """
    Aplica a lógica da Camada Prata e insere nas tabelas do Supabase.
    Partidas limpas → matches + match_participants.
    Partidas sujas  → matches_dirty (com reason).
    Retorna {"saved": True/False, "reason": "..."}.
    """
    metadata = match_data.get("metadata", {})
    info = match_data.get("info", {})
    match_id = metadata.get("matchId")

    if not match_id or not info:
        _salvar_dirty(supabase, match_id, {}, "invalid_json")
        return {"saved": False, "reason": "invalid_json"}

    queue_id = info.get("queueId", 0)
    game_duration = info.get("gameDuration", 0)

    # Filtro 1: somente SoloQ (420) e Flex (440)
    if queue_id not in RANKED_QUEUE_IDS:
        reason = f"wrong_queue:{queue_id}"
        logger.info(f"[dirty] {match_id} — {reason}")
        _salvar_dirty(supabase, match_id, info, reason)
        return {"saved": False, "reason": reason}

    # Filtro 2: remakes / partidas curtas (< 15 min)
    if game_duration < 900:
        reason = "remake" if game_duration < 300 else "short_game"
        logger.info(f"[dirty] {match_id} — {reason} ({game_duration}s)")
        _salvar_dirty(supabase, match_id, info, reason)
        return {"saved": False, "reason": reason}

    end_type = _classificar_tipo_final(info)

    # ── Extrair bans ────────────────────────────────────────────
    bans = []
    champ_id_to_name = _get_champion_id_map()

    for team in info.get("teams", []):
        team_id = team.get("teamId", 0)
        for ban in team.get("bans", []):
            champ_id = ban.get("championId", 0)
            if champ_id > 0:
                bans.append({
                    "team_id": team_id,
                    "champion_id": champ_id,
                    "champion_name": champ_id_to_name.get(champ_id, f"Champion_{champ_id}"),
                    "pick_turn": ban.get("pickTurn", 0),
                })

    # ── 1. Tabela: matches ────────────────────────────────────
    match_payload = {
        "match_id": match_id,
        "game_version": _normalizar_patch(info.get("gameVersion", "")),
        "game_duration": game_duration,
        "queue_id": info.get("queueId"),
        "end_type": end_type,
        "game_end_timestamp": info.get("gameEndTimestamp"),
        "bans": bans,
    }
    supabase.table("matches").upsert(match_payload).execute()

    # ── 2. Tabelas: players + match_participants ──────────────
    players_payload = []
    participants_payload = []

    # PUUIDs na ordem do participantId (1-10) — necessário para a timeline
    puuids_ordered: list[str] = metadata.get("participants", [])

    for p in info.get("participants", []):
        puuid = p.get("puuid")

        players_payload.append({
            "puuid": puuid,
            "game_name": p.get("riotIdGameName", "Desconhecido"),
            "tag_line": p.get("riotIdTagline", "UNK"),
            "profile_icon_id": p.get("profileIcon"),
        })

        challenges = p.get("challenges", {})
        time_played = p.get("timePlayed", game_duration)
        is_afk = p.get("teamEarlySurrendered", False) or (time_played < (game_duration * 0.8))
        challenges["is_afk"] = is_afk

        # ── Items (slots 0-6, item6 = trinket) ────────────────
        items = [p.get(f"item{i}", 0) for i in range(7)]

        # ── Runas ─────────────────────────────────────────────
        perks = p.get("perks", {})
        styles = perks.get("styles", [])
        primary        = styles[0] if styles else {}
        secondary      = styles[1] if len(styles) > 1 else {}
        primary_sels   = primary.get("selections") or []
        keystone       = primary_sels[0].get("perk") if primary_sels else None

        # ── CS e CS/min ────────────────────────────────────────
        total_cs = p.get("totalMinionsKilled", 0) + p.get("neutralMinionsKilled", 0)
        cspm = round(total_cs / (game_duration / 60), 2) if game_duration > 0 else 0.0

        participants_payload.append({
            "match_id": match_id,
            "puuid": puuid,
            "champion_name": p.get("championName"),
            "team_position": p.get("teamPosition") or "UNKNOWN",
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
            # challenges JSONB removido pra economizar espaço (~15MB/6k rows)
            # ── Novos campos ───────────────────────────────────
            "team_id":         p.get("teamId"),
            "items":           items,
            "summoner1_id":    p.get("summoner1Id"),
            "summoner2_id":    p.get("summoner2Id"),
            "rune_keystone":   keystone,
            "rune_primary":    primary.get("style"),
            "rune_secondary":  secondary.get("style"),
            "runes_raw":       perks,
            "total_cs":        total_cs,
            "cs_per_minute":   float(cspm),
            "champion_level":  p.get("champLevel", 1),
            "items_purchased": p.get("itemsPurchased", 0),
        })

    supabase.table("players").upsert(players_payload).execute()
    supabase.table("match_participants").upsert(
        participants_payload, on_conflict="match_id,puuid"
    ).execute()

    return {"saved": True, "reason": f"OK ({end_type})", "puuids": puuids_ordered}


def _salvar_timeline(
    supabase: Client,
    lol_watcher: LolWatcher,
    routing: str,
    match_id: str,
    puuids_ordered: list[str],
) -> None:
    """
    Busca a timeline da partida na Riot API e salva em match_timelines.
    Um frame por minuto (timestamp múltiplo de ~60000ms).
    Chamada apenas quando a partida é salva pela primeira vez — nunca rebusca.
    """
    try:
        tl = lol_watcher.match.timeline_by_match(routing, match_id)
        frames_raw = tl.get("info", {}).get("frames", [])

        frames = []
        for frame in frames_raw:
            ts = frame.get("timestamp", 0)
            minute = ts // 60000
            participant_frames = frame.get("participantFrames", {})

            participants_snap: dict[str, dict] = {}
            for pid_str, pf in participant_frames.items():
                idx = int(pid_str) - 1
                if idx < 0 or idx >= len(puuids_ordered):
                    continue
                puuid = puuids_ordered[idx]
                cs = pf.get("minionsKilled", 0) + pf.get("jungleMinionsKilled", 0)
                participants_snap[puuid] = {
                    "cs":    cs,
                    "cspm":  round(cs / minute, 2) if minute > 0 else 0.0,
                    "gold":  pf.get("totalGold", 0),
                    "level": pf.get("level", 1),
                    "xp":    pf.get("xp", 0),
                }

            frames.append({
                "t_ms":  ts,
                "t_min": minute,
                "p":     participants_snap,
            })

        if frames:
            from backend.api.routes.match import _write_timeline_r2
            _write_timeline_r2(match_id, frames)
            logger.info(f"[timeline] {match_id} — {len(frames)} frames salvos no R2")

    except Exception as e:
        logger.warning(f"[timeline] {match_id} falhou (não bloqueia o sync): {e}")


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
    if not game_name.strip():
        raise ValueError("game_name não pode ser vazio")
    if not tag_line.strip():
        raise ValueError("tag_line não pode ser vazio")

    if not RIOT_API_KEY:
        raise RuntimeError("RIOT_API_KEY não encontrada no .env")

    riot_watcher = RiotWatcher(RIOT_API_KEY)
    lol_watcher = LolWatcher(RIOT_API_KEY)
    supabase = _get_supabase()
    routing = _get_routing_region(server)

    # ── 0. Verificar cooldown (antes de chamar a Riot API) ───
    # Usamos limit(1) em vez de maybe_single() para evitar 406 quando há
    # múltiplos registros com o mesmo game_name+tag_line (ex: duplicata de PUUID).
    existing_rows = (
        supabase.table("players")
        .select("last_synced_at, puuid")
        .ilike("game_name", game_name)
        .ilike("tag_line", tag_line)
        .order("last_synced_at", desc=True, nullsfirst=False)
        .limit(1)
        .execute()
    )
    existing_row = existing_rows.data[0] if (existing_rows and existing_rows.data) else None
    if existing_row and existing_row.get("last_synced_at"):
        raw_ts = existing_row["last_synced_at"]
        last = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
        elapsed = (datetime.now(timezone.utc) - last).total_seconds()
        if elapsed < SYNC_COOLDOWN_SECONDS:
            raise SyncCooldownError(int(SYNC_COOLDOWN_SECONDS - elapsed))

    # ── 1. Buscar PUUID + ícone de perfil ───────────────────
    account = riot_watcher.account.by_riot_id(routing, game_name, tag_line)
    puuid = account["puuid"]

    # Summoner API retorna profileIconId (platform endpoint, não routing)
    try:
        summoner = lol_watcher.summoner.by_puuid(server.lower(), puuid)
        profile_icon_id = summoner.get("profileIconId")
    except Exception:
        profile_icon_id = None

    # ── Detectar mudanca de nome ─────────────────────────────
    try:
        existing = (
            supabase.table("players")
            .select("game_name, tag_line")
            .eq("puuid", puuid)
            .limit(1)
            .execute()
        )
        if existing.data:
            old = existing.data[0]
            old_name = old.get("game_name", "")
            old_tag = old.get("tag_line", "")
            if old_name and (old_name != game_name or old_tag != tag_line):
                supabase.table("player_name_history").insert({
                    "puuid": puuid,
                    "old_game_name": old_name,
                    "old_tag_line": old_tag,
                }).execute()
                logger.info(f"[nome] {old_name}#{old_tag} -> {game_name}#{tag_line}")
    except Exception as e:
        logger.warning(f"[nome] Erro ao verificar historico de nomes: {e}")

    # Atualiza/cria o jogador com server, ícone e marca last_synced_at
    supabase.table("players").upsert({
        "puuid": puuid,
        "game_name": game_name,
        "tag_line": tag_line,
        "server": server,
        "profile_icon_id": profile_icon_id,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    # ── 2. Buscar histórico completo (todas as filas) ────────
    # Sem filtro de type/queue: SoloQ e Flex vão para matches (clean),
    # o resto vai para matches_dirty. A separação é feita em _processar_e_salvar().
    match_ids: list[str] = lol_watcher.match.matchlist_by_puuid(
        routing, puuid, count=count
    )
    logger.info(f"[historico] {game_name}#{tag_line} — {len(match_ids)} partidas encontradas na Riot API")

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
                # Buscar e salvar timeline logo após a partida ser salva
                puuids = resultado.get("puuids", [])
                if puuids:
                    _salvar_timeline(supabase, lol_watcher, routing, match_id, puuids)

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
