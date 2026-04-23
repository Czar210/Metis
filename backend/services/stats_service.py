"""
stats_service.py — Agregações estatísticas sobre match_participants.

Fluxo:
  Supabase (match_participants + matches + players) → filtros → agregação Python → dict de resposta

Nota sobre o filtro ?elo=:
  Elo/tier (Challenger, Diamond, etc.) não está armazenado por partida no schema atual.
  O parâmetro é aceito mas ignorado — será implementado quando a tabela player_ranks existir.
"""

from __future__ import annotations
from collections import defaultdict
from typing import Any
import time
import logging

logger = logging.getLogger(__name__)

# ── Cache simples em memoria com TTL ─────────────────────────────────────────
# Persiste enquanto o processo estiver rodando (Railway mantem UP 24h+).
# Chave = string descrevendo os filtros. Valor = (timestamp, dados).
_CACHE_TTL = 60 * 60 * 24  # 24 horas em segundos
_cache: dict[str, tuple[float, Any]] = {}


def _cache_get(key: str) -> Any | None:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < _CACHE_TTL:
            return data
        del _cache[key]
    return None


def _cache_set(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


def buscar_patches_disponiveis(db_client) -> list[str]:
    """Retorna lista de patches distintos. Cacheado por 24h."""
    cache_key = "patches"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    result = db_client.table("matches").select("game_version").execute()
    rows = result.data or []
    patches = sorted(
        {r["game_version"] for r in rows if r.get("game_version")},
        key=lambda v: [int(x) for x in v.split(".")[:2]] if v else [0, 0],
        reverse=True,
    )
    _cache_set(cache_key, patches)
    logger.info(f"[cache] patches atualizados: {patches[:3]}...")
    return patches


def buscar_stats_campeao(
    db_client,
    champion: str,
    role: str | None = None,
    server: str | None = None,
    patch: str | None = None,
    min_matches: int = 1,
) -> dict[str, Any]:
    """
    Agrega estatísticas de um campeão a partir do Supabase.

    Retorna sempre 200 — se total_matches < min_matches, retorna stats=None.
    """
    # ── Busca paginada ─────────────────────────────────────────────────
    select_cols = (
        "champion_name, team_position, win, kills, deaths, assists, "
        "gold_earned, damage_per_minute, kill_participation, "
        "matches(game_version, queue_id), players(server)"
    )
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        q = db_client.table("match_participants").select(select_cols).ilike("champion_name", champion)
        if role:
            q = q.eq("team_position", role.upper())
        batch = q.range(offset, offset + page_size - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    # ── Filtros Python para campos de tabelas relacionadas ─────────────────────
    if server:
        rows = [
            r for r in rows
            if (r.get("players") or {}).get("server", "").upper() == server.upper()
        ]

    if patch:
        rows = [
            r for r in rows
            if (r.get("matches") or {}).get("game_version") == patch
        ]

    total = len(rows)

    if total < min_matches:
        return {
            "champion": champion,
            "filters": {"role": role, "server": server, "patch": patch},
            "total_matches": total,
            "stats": None,
        }

    # ── Agregação ──────────────────────────────────────────────────────────────
    wins = sum(1 for r in rows if r.get("win"))

    def avg(field: str, default: float = 0.0) -> float:
        return sum(r.get(field, default) for r in rows) / total

    return {
        "champion": champion,
        "filters": {"role": role, "server": server, "patch": patch},
        "total_matches": total,
        "stats": {
            "winrate": round(wins / total * 100, 2),
            "avg_kills": round(avg("kills"), 2),
            "avg_deaths": round(avg("deaths"), 2),
            "avg_assists": round(avg("assists"), 2),
            "avg_gold": round(avg("gold_earned"), 0),
            "avg_damage_per_minute": round(avg("damage_per_minute"), 1),
            "avg_kill_participation": round(avg("kill_participation"), 3),
        },
    }


def buscar_tierlist(
    db_client,
    role: str | None = None,
    server: str | None = None,
    patch: str | None = None,
    patch_list: list[str] | None = None,
    min_matches: int = 1,
    min_role_share: float = 0.15,
    min_matches_relative: int = 10,
) -> list[dict[str, Any]]:
    """
    Agrega estatísticas de TODOS os campeões para montar a Tier List.
    Cacheado por 24h por combinacao de filtros.

    Filtro de significância (nicho legítimo):
      - Entra se `total_matches >= min_matches` (piso absoluto)
      - OU se `role_share >= min_role_share` E `total_matches >= min_matches_relative`

    Tier assignment: z-score do winrate dentro da role.
      S+ ≥ +2σ · S ≥ +1σ · A ≥ 0 · B ≥ -1σ · C ≥ -2σ · D < -2σ
    """
    cache_key = (
        f"tierlist|{role}|{server}|{patch}|{sorted(patch_list) if patch_list else None}"
        f"|{min_matches}|{min_role_share}|{min_matches_relative}"
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.debug(f"[cache] tierlist hit: {cache_key[:60]}")
        return cached

    # Paginar pra pegar TODOS os registros (PostgREST limita 1000 por default)
    select_cols = (
        "match_id, champion_name, team_position, win, kills, deaths, assists, "
        "gold_earned, damage_per_minute, "
        "matches(game_version, queue_id, bans), players(server)"
    )
    rows: list[dict] = []
    page_size = 1000
    offset = 0

    while True:
        q = db_client.table("match_participants").select(select_cols)
        if role:
            q = q.eq("team_position", role.upper())
        result = q.range(offset, offset + page_size - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    logger.info(f"[tierlist] {len(rows)} participantes carregados")

    # Filtros Python para campos de tabelas relacionadas
    if server:
        rows = [
            r for r in rows
            if (r.get("players") or {}).get("server", "").upper() == server.upper()
        ]
    if patch:
        rows = [
            r for r in rows
            if (r.get("matches") or {}).get("game_version") == patch
        ]
    elif patch_list:
        patch_set = set(patch_list)
        rows = [
            r for r in rows
            if (r.get("matches") or {}).get("game_version") in patch_set
        ]

    ROLE_LABELS = {
        "TOP": "Top", "JUNGLE": "Jungle", "MIDDLE": "Mid",
        "BOTTOM": "ADC", "UTILITY": "Suporte",
    }

    # Total de partidas unicas (para pickrate)
    all_match_ids = {r.get("match_id") for r in rows if r.get("match_id")}
    total_unique_matches = len(all_match_ids) or 1

    # Contagem de bans por campeao (de todas as partidas no filtro)
    ban_counts: dict[str, int] = defaultdict(int)
    seen_bans: set[str] = set()  # match_id|champion para nao contar duplicado
    for r in rows:
        match_info = r.get("matches") or {}
        bans = match_info.get("bans") or []
        mid = r.get("match_id", "")
        for ban in bans:
            cname = ban.get("champion_name", "")
            ban_key = f"{mid}|{cname}"
            if cname and ban_key not in seen_bans:
                ban_counts[cname] += 1
                seen_bans.add(ban_key)

    # Agrupamento por (champion, role)
    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        name = r.get("champion_name")
        pos = r.get("team_position", "UNKNOWN")
        if name and pos != "UNKNOWN":
            key = f"{name}|{pos}"
            buckets[key].append(r)

    # Total de partidas de cada campeão em TODAS as roles (pra computar role_share).
    # Precisamos disso antes do filtro pra cada (champ, role) saber o denominador real.
    matches_per_champion: dict[str, int] = defaultdict(int)
    for key, champ_rows in buckets.items():
        champion, _ = key.split("|", 1)
        matches_per_champion[champion] += len(champ_rows)

    # Monta result_list com role_share + aplica filtro de significância.
    result_list: list[dict[str, Any]] = []
    for key, champ_rows in buckets.items():
        total = len(champ_rows)
        champion, champ_role = key.split("|", 1)
        champ_total_all_roles = matches_per_champion[champion]
        role_share = total / champ_total_all_roles if champ_total_all_roles > 0 else 0.0

        # Filtro combinado: piso absoluto OU (role_share alta E piso relativo)
        passes_abs = total >= min_matches
        passes_nicho = role_share >= min_role_share and total >= min_matches_relative
        if not (passes_abs or passes_nicho):
            continue

        wins = sum(1 for r in champ_rows if r.get("win"))

        def avg(field: str) -> float:
            return sum(r.get(field) or 0 for r in champ_rows) / total

        avg_deaths = avg("deaths")
        kda = round((avg("kills") + avg("assists")) / max(avg_deaths, 0.1), 2)

        result_list.append({
            "champion": champion,
            "role": champ_role,
            "role_label": ROLE_LABELS.get(champ_role, champ_role),
            "total_matches": total,
            "winrate": round(wins / total * 100, 2),
            "pickrate": round(total / total_unique_matches * 100, 2),
            "banrate": round(ban_counts.get(champion, 0) / total_unique_matches * 100, 2),
            "role_share": round(role_share * 100, 1),   # % dos jogos do champ nessa role
            "kda": kda,
            "avg_kills": round(avg("kills"), 2),
            "avg_deaths": round(avg("deaths"), 2),
            "avg_assists": round(avg("assists"), 2),
            "avg_gold": round(avg("gold_earned"), 0),
            "avg_damage_per_minute": round(avg("damage_per_minute"), 1),
        })

    result_list.sort(key=lambda x: x["winrate"], reverse=True)

    # ── Tier badges por percentil DENTRO de cada role ─────────────────────────
    # Agrupa por role, calcula percentil separado — Viktor Mid vs outros Mid
    by_role: dict[str, list[dict]] = defaultdict(list)
    for c in result_list:
        by_role[c["role"]].append(c)

    def _assign_tiers(items: list[dict]) -> None:
        """Tier por desvio padrão do winrate dentro da role.

        Critério absoluto (não percentil): se o meta está balanceado e
        ninguém fica +2σ acima, ninguém é S+ — e tá tudo certo.

            S+ ≥ +2.0σ   (≈ top 2.5%)
            S  ≥ +1.0σ   (≈ top 16%)
            A  ≥  0.0σ   (acima da média)
            B  ≥ -1.0σ
            C  ≥ -2.0σ
            D  <  -2.0σ
        """
        if not items:
            return
        wrs = [c["winrate"] for c in items]
        n = len(wrs)
        mean = sum(wrs) / n
        variance = sum((w - mean) ** 2 for w in wrs) / n if n > 1 else 0.0
        stddev = variance ** 0.5

        for c in items:
            if stddev == 0:
                # Sem variação — todo mundo na média
                c["z_score"] = 0.0
                c["tier"] = "A"
                continue
            z = (c["winrate"] - mean) / stddev
            c["z_score"] = round(z, 2)
            if z >= 2.0:   c["tier"] = "S+"
            elif z >= 1.0: c["tier"] = "S"
            elif z >= 0.0: c["tier"] = "A"
            elif z >= -1.0: c["tier"] = "B"
            elif z >= -2.0: c["tier"] = "C"
            else:           c["tier"] = "D"

    for role_items in by_role.values():
        _assign_tiers(role_items)

    _cache_set(cache_key, result_list)
    logger.info(f"[cache] tierlist armazenado: {len(result_list)} entradas ({cache_key[:60]})")
    return result_list
