"""
match.py — Rotas de detalhes de partida (prefixo: /api/v1/match)

Endpoints:
  GET /api/v1/match/{match_id}          →  Scoreboard completo da partida
  GET /api/v1/match/{match_id}/timeline →  Frames da timeline (cache ou Riot API)
"""

from fastapi import APIRouter, HTTPException
import gzip
import json
import os
from supabase import create_client
from riotwatcher import LolWatcher, ApiError


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(url, key)


def _get_r2_client():
    try:
        import boto3
        account_id = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
        access_key = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
        secret_key = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
        if not all([account_id, access_key, secret_key]):
            return None
        return boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
        )
    except Exception:
        return None


def _r2_key(match_id: str) -> str:
    return f"timeline_frames/{match_id}.json.gz"


def _timeline_exists_r2(match_id: str) -> bool:
    s3 = _get_r2_client()
    if not s3:
        return False
    bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
    try:
        s3.head_object(Bucket=bucket, Key=_r2_key(match_id))
        return True
    except Exception:
        return False


def _read_timeline_r2(match_id: str) -> list | None:
    s3 = _get_r2_client()
    if not s3:
        return None
    bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
    try:
        obj = s3.get_object(Bucket=bucket, Key=_r2_key(match_id))
        data = json.loads(gzip.decompress(obj["Body"].read()))
        return data.get("frames")
    except Exception:
        return None


def _write_timeline_r2(match_id: str, frames: list) -> bool:
    s3 = _get_r2_client()
    if not s3:
        return False
    bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")
    try:
        payload = json.dumps({"match_id": match_id, "frames": frames}, ensure_ascii=False)
        s3.put_object(
            Bucket=bucket,
            Key=_r2_key(match_id),
            Body=gzip.compress(payload.encode("utf-8")),
            ContentType="application/gzip",
        )
        return True
    except Exception:
        return False


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


# ── Metis Score ──────────────────────────────────────────────────

# Pesos por role: KDA, Damage, Gold, Vision, CS/m, KP
_ROLE_WEIGHTS: dict[str, dict[str, float]] = {
    "TOP":     {"kda": 0.25, "dmg": 0.15, "gold": 0.20, "vis": 0.05, "cs": 0.15, "kp": 0.10},
    "JUNGLE":  {"kda": 0.25, "dmg": 0.10, "gold": 0.10, "vis": 0.15, "cs": 0.10, "kp": 0.25},
    "MIDDLE":  {"kda": 0.25, "dmg": 0.20, "gold": 0.20, "vis": 0.05, "cs": 0.20, "kp": 0.25},
    "BOTTOM":  {"kda": 0.25, "dmg": 0.30, "gold": 0.25, "vis": 0.05, "cs": 0.25, "kp": 0.10},
    "UTILITY": {"kda": 0.25, "dmg": 0.05, "gold": 0.05, "vis": 0.30, "cs": 0.05, "kp": 0.25},
}
_DEFAULT_WEIGHTS = {"kda": 0.20, "dmg": 0.15, "gold": 0.15, "vis": 0.15, "cs": 0.15, "kp": 0.15}


def _compute_metis_scores(participants: list[dict]) -> None:
    """Calcula metis_score in-place para cada participante, normalizado contra a média da partida."""
    n = len(participants)
    if n == 0:
        return

    def _safe(val) -> float:
        return float(val) if val else 0.0

    # Médias da partida
    avg_gold = sum(_safe(p.get("gold_earned")) for p in participants) / n or 1
    avg_vis  = sum(_safe(p.get("vision_score")) for p in participants) / n or 1
    avg_cspm = sum(_safe(p.get("cs_per_minute")) for p in participants) / n or 1

    # Dano total por time (para damage share)
    team_dmg: dict[int, float] = {}
    for p in participants:
        tid = p.get("team_id", 0)
        team_dmg[tid] = team_dmg.get(tid, 0) + _safe(p.get("total_damage_dealt_to_champions"))

    for p in participants:
        kills   = _safe(p.get("kills"))
        deaths  = _safe(p.get("deaths"))
        assists = _safe(p.get("assists"))
        gold    = _safe(p.get("gold_earned"))
        damage  = _safe(p.get("total_damage_dealt_to_champions"))
        vision  = _safe(p.get("vision_score"))
        cspm    = _safe(p.get("cs_per_minute"))
        kp      = _safe(p.get("kill_participation"))

        role = (p.get("team_position") or "UNKNOWN").upper()
        w = _ROLE_WEIGHTS.get(role, _DEFAULT_WEIGHTS)

        # Componentes normalizados (0-1 range, capped at 2x average)
        kda_ratio = (kills + assists) / max(deaths, 1)
        kda_norm  = min(kda_ratio / 5.0, 1.0)  # KDA 5.0+ = score 1.0

        t_dmg = team_dmg.get(p.get("team_id", 0), 1) or 1
        dmg_norm  = min(damage / t_dmg / 0.3, 1.0)  # 30%+ do dano do time = 1.0

        gold_norm = min(gold / avg_gold / 1.5, 1.0)  # 1.5x gold médio = 1.0
        vis_norm  = min(vision / avg_vis / 1.5, 1.0)
        cs_norm   = min(cspm / avg_cspm / 1.5, 1.0) if avg_cspm > 0 else 0
        kp_norm   = min(kp / 0.7, 1.0)  # 70%+ KP = 1.0

        raw = (
            w["kda"]  * kda_norm +
            w["dmg"]  * dmg_norm +
            w["gold"] * gold_norm +
            w["vis"]  * vis_norm +
            w["cs"]   * cs_norm +
            w["kp"]   * kp_norm
        )

        p["metis_score"] = round(raw * 100, 1)


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
                "items, rune_keystone, rune_primary, rune_secondary, runes_raw, summoner1_id, summoner2_id, "
                "players(game_name, tag_line), "
                "matches(match_id, game_version, game_duration, queue_id, end_type, created_at, bans)"
            )
            .eq("match_id", match_id)
            .execute()
        )

        participants = result.data or []
        if not participants:
            raise HTTPException(status_code=404, detail=f"Partida '{match_id}' não encontrada.")

        # ── Timeline flag ─────────────────────────────────────
        has_timeline = _timeline_exists_r2(match_id)

        # ── max_damage para normalização de barras ────────────
        max_damage = max(
            (p.get("total_damage_dealt_to_champions") or 0 for p in participants),
            default=0,
        ) or 1  # garante mínimo 1 para evitar divisão por zero no frontend

        # ── Split por time ────────────────────────────────────
        blue_team = [p for p in participants if p.get("team_id") == 100]
        red_team  = [p for p in participants if p.get("team_id") == 200]

        # ── Metis Score (normalizado contra média da partida, pesos por role) ──
        _compute_metis_scores(participants)

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
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")


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
        frames_cached = _read_timeline_r2(match_id)
        if frames_cached is not None:
            return {"match_id": match_id, "frames": frames_cached}

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
            _write_timeline_r2(match_id, frames)

        return {"match_id": match_id, "frames": frames}

    except HTTPException:
        raise
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")
