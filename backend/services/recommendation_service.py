"""
recommendation_service.py — Recomendacao de campeoes por LANE via similaridade de cosseno.

Baseado no Neo-Artemis (8 dimensoes compostas), adaptado pra todas as roles.
Diana JG e Diana Mid sao perfis completamente diferentes.

Dimensoes:
  1. Agressividade (kills, solo kills, KP, DPM)
  2. Controle de Mapa (vision, wards)
  3. Eficiencia de Recursos (gold/m, CS/m, XP)
  4. Pressao em Estruturas (dano a torres)
  5. Sobrevivencia (KDA, deaths penalty)
  6. Utilidade (CC, assists ratio)
  7. Early Game (early gold/xp advantage)
  8. Consistencia (winrate, low variance)
"""

from __future__ import annotations
import math
from collections import defaultdict
from typing import Any

ROLE_LABELS = {"TOP": "Top", "JUNGLE": "Jungle", "MIDDLE": "Mid", "BOTTOM": "ADC", "UTILITY": "Suporte"}

DIMENSION_NAMES = [
    "Agressividade",
    "Controle de Mapa",
    "Eficiencia",
    "Pressao",
    "Sobrevivencia",
    "Utilidade",
    "Early Game",
    "Consistencia",
]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _safe(val, default=0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _challenge(row: dict, key: str, default=0.0) -> float:
    """Extrai um campo do challenges JSONB."""
    ch = row.get("challenges")
    if isinstance(ch, dict):
        return _safe(ch.get(key), default)
    return default


def _build_8d_profile(rows: list[dict]) -> list[float]:
    """
    Constroi vetor 8D a partir de match_participants rows.
    Cada dimensao e normalizada pra escala 0-10.
    """
    n = len(rows)
    if n == 0:
        return [0.0] * 8

    def avg(field: str) -> float:
        return sum(_safe(r.get(field)) for r in rows) / n

    def avg_ch(key: str) -> float:
        return sum(_challenge(r, key) for r in rows) / n

    avg_kills = avg("kills")
    avg_deaths = max(avg("deaths"), 0.1)
    avg_assists = avg("assists")

    # 1. Agressividade (0-10)
    kda_aggro = min(avg_kills / 3.0, 1.0)  # 3+ kills/game = 1.0
    solo_kills = min(avg_ch("soloKills") / 1.5, 1.0)
    kp = min(_safe(avg("kill_participation")) / 0.7, 1.0)
    dpm = min(_safe(avg("damage_per_minute")) / 800, 1.0)
    agressividade = (kda_aggro * 0.25 + solo_kills * 0.2 + kp * 0.3 + dpm * 0.25) * 10

    # 2. Controle de Mapa (0-10)
    vision = min(_safe(avg("vision_score")) / 30, 1.0)
    controle_mapa = vision * 10

    # 3. Eficiencia de Recursos (0-10)
    gold_pm = min(_safe(avg("gold_earned")) / 14000, 1.0)
    cspm = min(_safe(avg("cs_per_minute")) / 8.0, 1.0)
    eficiencia = (gold_pm * 0.5 + cspm * 0.5) * 10

    # 4. Pressao em Estruturas (0-10)
    dmg_buildings = min(avg_ch("damageDealtToBuildings") if avg_ch("damageDealtToBuildings") > 0 else _safe(avg("damage_dealt_to_buildings")) / 3000, 1.0)
    pressao = dmg_buildings * 10

    # 5. Sobrevivencia (0-10)
    kda_ratio = (avg_kills + avg_assists) / avg_deaths
    kda_score = min(kda_ratio / 5.0, 1.0)
    death_penalty = max(0, 1.0 - avg_deaths / 8.0)
    sobrevivencia = (kda_score * 0.6 + death_penalty * 0.4) * 10

    # 6. Utilidade (0-10)
    assist_ratio = avg_assists / max(avg_kills + avg_assists, 1)
    utilidade = min(assist_ratio / 0.7, 1.0) * 10

    # 7. Early Game (0-10)
    early_adv = min(max(avg_ch("earlyLaningPhaseGoldExpAdvantage"), 0) / 500, 1.0)
    early_game = early_adv * 10

    # 8. Consistencia (0-10)
    winrate = sum(1 for r in rows if r.get("win")) / n
    consistencia = winrate * 10

    profile = [
        round(min(max(agressividade, 0), 10), 2),
        round(min(max(controle_mapa, 0), 10), 2),
        round(min(max(eficiencia, 0), 10), 2),
        round(min(max(pressao, 0), 10), 2),
        round(min(max(sobrevivencia, 0), 10), 2),
        round(min(max(utilidade, 0), 10), 2),
        round(min(max(early_game, 0), 10), 2),
        round(min(max(consistencia, 0), 10), 2),
    ]
    return profile


def _explain_match(player_vec: list[float], champ_vec: list[float]) -> list[str]:
    """Gera explicacoes de porque o campeao combina."""
    reasons = []
    for i, (pv, cv) in enumerate(zip(player_vec, champ_vec)):
        if pv < 1 or cv < 1:
            continue
        diff = abs(pv - cv)
        if diff <= 1.5:
            reasons.append(f"{DIMENSION_NAMES[i]} compativel")
        elif cv > pv + 2:
            reasons.append(f"Pode melhorar seu {DIMENSION_NAMES[i]}")
    return reasons[:3]


def buscar_recomendacoes(
    db_client,
    puuid: str,
    role: str | None = None,
    top_n: int = 5,
    include_reasons: bool = False,
) -> list[dict[str, Any]]:
    """
    Recomenda campeoes POR LANE baseado no perfil 8D do jogador.
    Scores mais estritos (0-100% real, nao 100% facil).
    """
    # 1. Partidas do jogador
    player_rows: list[dict] = (
        db_client.table("match_participants")
        .select(
            "kills, deaths, assists, cs_per_minute, damage_per_minute, "
            "vision_score, kill_participation, gold_earned, "
            "damage_dealt_to_buildings, champion_name, team_position, win, challenges"
        )
        .eq("puuid", puuid)
        .execute()
        .data or []
    )

    if len(player_rows) < 5:
        return []

    # Perfil geral do jogador (8D)
    player_profile = _build_8d_profile(player_rows)

    # Perfil do jogador por role
    player_by_role: dict[str, list[dict]] = defaultdict(list)
    for r in player_rows:
        pos = r.get("team_position", "UNKNOWN")
        player_by_role[pos].append(r)

    # Campeoes que o jogador ja joga por role
    player_champs: dict[str, int] = defaultdict(int)
    for r in player_rows:
        key = f"{r.get('champion_name')}|{r.get('team_position')}"
        player_champs[key] += 1

    # 2. Todos os participantes → perfis por (champion, role)
    all_rows: list[dict] = (
        db_client.table("match_participants")
        .select(
            "champion_name, team_position, kills, deaths, assists, "
            "cs_per_minute, damage_per_minute, vision_score, "
            "kill_participation, gold_earned, damage_dealt_to_buildings, win, challenges"
        )
        .execute()
        .data or []
    )

    # Agrupar por (champion, role)
    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in all_rows:
        name = r.get("champion_name")
        pos = r.get("team_position", "UNKNOWN")
        if name and pos != "UNKNOWN":
            buckets[f"{name}|{pos}"].append(r)

    # 3. Calcular similaridade (mais estrita com 8D)
    results: list[dict[str, Any]] = []
    for key, champ_rows in buckets.items():
        if len(champ_rows) < 3:
            continue

        champ_name, champ_role = key.split("|", 1)
        if role and champ_role != role.upper():
            continue

        champ_profile = _build_8d_profile(champ_rows)
        wins = sum(1 for r in champ_rows if r.get("win"))

        # Perfil role-specific do jogador se tiver dados
        role_rows = player_by_role.get(champ_role, [])
        compare_profile = _build_8d_profile(role_rows) if len(role_rows) >= 3 else player_profile

        # Cosine similarity (0.0 a 1.0) — com 8D e mais granular que 6D
        raw_sim = _cosine_similarity(compare_profile, champ_profile)

        # Penalidade por distancia euclidiana (torna mais estrito)
        euclidean_dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(compare_profile, champ_profile)))
        max_dist = math.sqrt(8 * 100)  # max possivel (8 dims, range 0-10)
        dist_penalty = 1.0 - min(euclidean_dist / (max_dist * 0.5), 1.0)

        # Score final: combina cosine (direcao) + distancia (magnitude)
        similarity = raw_sim * 0.6 + dist_penalty * 0.4

        # Novelty boost (menor que antes)
        played = player_champs.get(key, 0)
        novelty = 1.0 if played == 0 else max(0.7, 1.0 - played / 30)

        confidence = similarity * novelty

        entry: dict[str, Any] = {
            "champion": champ_name,
            "role": champ_role,
            "role_label": ROLE_LABELS.get(champ_role, champ_role),
            "similarity": round(similarity * 100, 1),
            "confidence": round(confidence * 100, 1),
            "winrate": round(wins / len(champ_rows) * 100, 1),
            "games_in_db": len(champ_rows),
            "times_played": played,
            "player_profile": compare_profile,
            "champion_profile": champ_profile,
        }

        if include_reasons:
            entry["reasons"] = _explain_match(compare_profile, champ_profile)

        results.append(entry)

    results.sort(key=lambda x: x["confidence"], reverse=True)
    return results[:top_n]
