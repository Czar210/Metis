"""
recommendation_service.py — Recomendacao de campeoes por LANE via similaridade de cosseno.

Diana JG e Diana Mid sao perfis completamente diferentes.
A chave e (champion_name, team_position), nao so champion_name.
"""

from __future__ import annotations
import math
from collections import defaultdict
from typing import Any

ROLE_LABELS = {"TOP": "Top", "JUNGLE": "Jungle", "MIDDLE": "Mid", "BOTTOM": "ADC", "UTILITY": "Suporte"}


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _build_profile(rows: list[dict]) -> list[float]:
    """Vetor 6D: KDA, CS/m, DPM, Vision, KP, Gold."""
    n = len(rows)
    if n == 0:
        return [0.0] * 6

    def avg(field: str) -> float:
        return sum(float(r.get(field) or 0) for r in rows) / n

    avg_deaths = max(avg("deaths"), 0.1)
    return [
        (avg("kills") + avg("assists")) / avg_deaths,
        avg("cs_per_minute"),
        avg("damage_per_minute"),
        avg("vision_score"),
        avg("kill_participation"),
        avg("gold_earned") / 1000,
    ]


def _explain_match(player_vec: list[float], champ_vec: list[float]) -> list[str]:
    """Gera explicacoes curtas de porque o campeao combina com o jogador."""
    labels = ["KDA", "CS/m", "DPM", "Visao", "KP", "Gold"]
    reasons = []
    for i, (pv, cv) in enumerate(zip(player_vec, champ_vec)):
        if pv == 0 or cv == 0:
            continue
        ratio = min(pv, cv) / max(pv, cv)
        if ratio >= 0.85:
            reasons.append(f"{labels[i]} similar ao seu perfil")
    return reasons[:3]


def buscar_recomendacoes(
    db_client,
    puuid: str,
    role: str | None = None,
    top_n: int = 5,
    include_reasons: bool = False,
) -> list[dict[str, Any]]:
    """
    Recomenda campeoes POR LANE baseado no perfil do jogador.

    Cada campeao+role e tratado como um pick distinto (Diana JG != Diana Mid).
    Filtro por role opcional. include_reasons=True adiciona explicacoes.
    """
    # 1. Partidas do jogador
    player_rows: list[dict] = (
        db_client.table("match_participants")
        .select("kills, deaths, assists, cs_per_minute, damage_per_minute, "
                "vision_score, kill_participation, gold_earned, champion_name, team_position")
        .eq("puuid", puuid)
        .execute()
        .data or []
    )

    if len(player_rows) < 5:
        return []

    # Perfil geral do jogador
    player_profile = _build_profile(player_rows)

    # Perfil do jogador por role (pra comparar role-specific)
    player_by_role: dict[str, list[dict]] = defaultdict(list)
    for r in player_rows:
        pos = r.get("team_position", "UNKNOWN")
        player_by_role[pos].append(r)

    # Campeoes que o jogador ja joga por role
    player_champs: dict[str, int] = defaultdict(int)
    for r in player_rows:
        key = f"{r.get('champion_name')}|{r.get('team_position')}"
        player_champs[key] += 1

    # 2. Todos os participantes do banco → perfis por (champion, role)
    all_rows: list[dict] = (
        db_client.table("match_participants")
        .select("champion_name, team_position, kills, deaths, assists, "
                "cs_per_minute, damage_per_minute, vision_score, "
                "kill_participation, gold_earned, win")
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

    # 3. Calcular similaridade
    results: list[dict[str, Any]] = []
    for key, champ_rows in buckets.items():
        if len(champ_rows) < 3:
            continue

        champ_name, champ_role = key.split("|", 1)

        if role and champ_role != role.upper():
            continue

        champ_profile = _build_profile(champ_rows)
        wins = sum(1 for r in champ_rows if r.get("win"))

        # Usar perfil role-specific do jogador se tiver dados suficientes
        role_rows = player_by_role.get(champ_role, [])
        compare_profile = _build_profile(role_rows) if len(role_rows) >= 3 else player_profile

        sim = _cosine_similarity(compare_profile, champ_profile)

        # Novelty boost
        played = player_champs.get(key, 0)
        novelty = 1.0 if played == 0 else max(0.5, 1.0 - played / 20)

        entry: dict[str, Any] = {
            "champion": champ_name,
            "role": champ_role,
            "role_label": ROLE_LABELS.get(champ_role, champ_role),
            "similarity": round(sim * 100, 1),
            "confidence": round(sim * novelty * 100, 1),
            "winrate": round(wins / len(champ_rows) * 100, 1),
            "games_in_db": len(champ_rows),
            "times_played": played,
        }

        if include_reasons:
            entry["reasons"] = _explain_match(compare_profile, champ_profile)

        results.append(entry)

    results.sort(key=lambda x: x["confidence"], reverse=True)
    return results[:top_n]
