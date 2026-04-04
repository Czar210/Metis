"""
match.py — Rotas de detalhes de partida (prefixo: /api/v1/match)

Endpoints:
  GET /api/v1/match/{match_id}          →  Scoreboard completo da partida
  GET /api/v1/match/{match_id}/timeline →  Frames da timeline (cache ou Riot API)
"""

from fastapi import APIRouter, HTTPException
import os
from supabase import create_client
from riotwatcher import LolWatcher, ApiError


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(url, key)


def _get_routing_region(server: str) -> str:
    server = server.upper()
    if server in {"BR1", "NA1", "LA1", "LA2"}:
        return "americas"
    if server in {"EUW1", "EUN1", "TR1", "RU"}:
        return "europe"
    if server in {"KR", "JP1"}:
        return "asia"
    if server in {"OC1", "PH2", "SG2", "TH2", "TW2", "VN2"}:
        return "sea"
    raise ValueError(f"Servidor desconhecido: '{server}'")


def _parse_timeline_frames(frames_raw: list, puuids_ordered: list[str]) -> list[dict]:
    """Converte frames brutos da Riot API para o formato { t_ms, t_min, p: {puuid: snap} }."""
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

        frames.append({"t_ms": ts, "t_min": minute, "p": participants_snap})
    return frames


router = APIRouter(prefix="/api/v1/match", tags=["Match"])


@router.get("/{match_id}")
def get_match_details(match_id: str):
    """
    📊 Detalhes Completos da Partida

    Retorna o scoreboard dividido em blue_team (team_id=100) e red_team (team_id=200),
    com todos os stats de cada participante.

    Inclui:
    - max_damage: maior dano aos campeões na partida (para normalizar barras no frontend)
    - has_timeline: se a tabela match_timelines tem dados para esta partida
    - Dados de match (duração, queue, patch, resultado) via nested select
    """
    try:
        db = _get_supabase()

        # ── Participantes ─────────────────────────────────────
        result = (
            db.table("match_participants")
            .select(
                "puuid, champion_name, team_position, team_id, win, "
                "kills, deaths, assists, gold_earned, "
                "total_damage_dealt_to_champions, vision_score, "
                "kill_participation, damage_per_minute, "
                "total_cs, cs_per_minute, champion_level, "
                "items, rune_keystone, summoner1_id, summoner2_id, "
                "players(game_name, tag_line), "
                "matches(match_id, game_version, game_duration, queue_id, end_type, created_at)"
            )
            .eq("match_id", match_id)
            .execute()
        )

        participants = result.data or []
        if not participants:
            raise HTTPException(status_code=404, detail=f"Partida '{match_id}' não encontrada.")

        # ── Timeline flag ─────────────────────────────────────
        tl_result = (
            db.table("match_timelines")
            .select("match_id")
            .eq("match_id", match_id)
            .maybe_single()
            .execute()
        )
        has_timeline = tl_result.data is not None

        # ── max_damage para normalização de barras ────────────
        max_damage = max(
            (p.get("total_damage_dealt_to_champions") or 0 for p in participants),
            default=0,
        ) or 1  # garante mínimo 1 para evitar divisão por zero no frontend

        # ── Split por time ────────────────────────────────────
        blue_team = [p for p in participants if p.get("team_id") == 100]
        red_team  = [p for p in participants if p.get("team_id") == 200]

        # Metadados vêm do primeiro participante (mesmos para todos)
        meta = participants[0].get("matches") or {}

        return {
            "match_id": match_id,
            "meta": meta,
            "has_timeline": has_timeline,
            "max_damage": max_damage,
            "blue_team": blue_team,
            "red_team": red_team,
        }

    except HTTPException:
        raise
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Erro interno: {err}")


@router.get("/{match_id}/timeline")
def get_match_timeline(match_id: str):
    """
    ⏱ Timeline da Partida (CS/m, Gold, XP por minuto, por PUUID)

    Cache hit  → retorna frames já salvos em match_timelines (sem chamar a Riot API).
    Cache miss → busca na Riot API, salva em match_timelines e retorna.

    Formato de cada frame:
      { "t_ms": int, "t_min": int, "p": { "<puuid>": { cs, cspm, gold, level, xp } } }
    """
    try:
        db = _get_supabase()

        # ── 1. Cache hit ──────────────────────────────────────
        tl_result = (
            db.table("match_timelines")
            .select("frames")
            .eq("match_id", match_id)
            .maybe_single()
            .execute()
        )
        if tl_result.data:
            return {"match_id": match_id, "frames": tl_result.data["frames"]}

        # ── 2. Verificar se a partida existe no banco ─────────
        p_result = (
            db.table("match_participants")
            .select("players(server)")
            .eq("match_id", match_id)
            .limit(1)
            .execute()
        )
        if not p_result.data:
            raise HTTPException(status_code=404, detail=f"Partida '{match_id}' não encontrada.")

        server = (p_result.data[0].get("players") or {}).get("server")
        if not server:
            raise HTTPException(
                status_code=422,
                detail="Servidor do jogador não disponível — não é possível buscar a timeline na Riot API.",
            )

        # ── 3. Riot API: buscar match (para ordem dos PUUIDs) + timeline ──
        riot_key = os.environ.get("RIOT_API_KEY")
        if not riot_key:
            raise HTTPException(status_code=500, detail="RIOT_API_KEY não configurada no servidor.")

        try:
            routing = _get_routing_region(server)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        lol = LolWatcher(riot_key)

        try:
            match_data = lol.match.by_id(routing, match_id)
            puuids_ordered: list[str] = match_data.get("metadata", {}).get("participants", [])

            tl = lol.match.timeline_by_match(routing, match_id)
        except ApiError as e:
            raise HTTPException(status_code=502, detail=f"Riot API retornou erro: {e}")

        # ── 4. Parsear e salvar ───────────────────────────────
        frames_raw = tl.get("info", {}).get("frames", [])
        frames = _parse_timeline_frames(frames_raw, puuids_ordered)

        if frames:
            db.table("match_timelines").upsert(
                {"match_id": match_id, "frames": frames},
                on_conflict="match_id",
            ).execute()

        return {"match_id": match_id, "frames": frames}

    except HTTPException:
        raise
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Erro interno: {err}")
