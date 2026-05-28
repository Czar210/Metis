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


def _build_tierlist_from_cache(
    cache_data: dict,
    role: str | None,
    server: str | None,
    min_matches: int,
    min_role_share: float,
    min_matches_relative: int,
) -> list[dict[str, Any]] | None:
    """
    Monta a tier list a partir dos dados pre-computados do R2.
    Retorna None se server for especificado (nao ha dados por servidor no cache).
    """
    if server:
        return None

    ROLE_LABELS = {
        "TOP": "Top", "JUNGLE": "Jungle", "MIDDLE": "Mid",
        "BOTTOM": "ADC", "UTILITY": "Suporte",
    }

    total_unique_matches = cache_data.get("total_unique_matches") or 1
    ban_counts: dict[str, int] = cache_data.get("ban_counts") or {}
    champions_raw: list[dict] = cache_data.get("champions") or []

    result_list: list[dict[str, Any]] = []
    for c in champions_raw:
        champ_role = c.get("role", "UNKNOWN")
        if role and champ_role != role.upper():
            continue

        total = c.get("total_matches", 0)
        wins = c.get("wins", 0)
        role_share = c.get("role_share", 0.0)

        passes_abs = total >= min_matches
        passes_nicho = (role_share >= min_role_share * 100) and total >= min_matches_relative
        if not (passes_abs or passes_nicho):
            continue

        champion = c["champion"]
        avg_deaths = c.get("avg_deaths") or 0
        kda = round((c.get("avg_kills", 0) + c.get("avg_assists", 0)) / max(avg_deaths, 0.1), 2)

        result_list.append({
            "champion": champion,
            "role": champ_role,
            "role_label": ROLE_LABELS.get(champ_role, champ_role),
            "total_matches": total,
            "winrate": round(wins / total * 100, 2) if total else 0.0,
            "pickrate": round(total / total_unique_matches * 100, 2),
            "banrate": round(ban_counts.get(champion, 0) / total_unique_matches * 100, 2),
            "role_share": role_share,
            "kda": kda,
            "avg_kills": c.get("avg_kills", 0),
            "avg_deaths": avg_deaths,
            "avg_assists": c.get("avg_assists", 0),
            "avg_gold": c.get("avg_gold", 0),
            "avg_damage_per_minute": c.get("avg_damage_per_minute", 0),
        })

    result_list.sort(key=lambda x: x["winrate"], reverse=True)

    by_role: dict[str, list[dict]] = defaultdict(list)
    for c in result_list:
        by_role[c["role"]].append(c)

    def _assign_tiers(items: list[dict]) -> None:
        if not items:
            return
        wrs = [c["winrate"] for c in items]
        n = len(wrs)
        mean = sum(wrs) / n
        variance = sum((w - mean) ** 2 for w in wrs) / n if n > 1 else 0.0
        stddev = variance ** 0.5
        for c in items:
            if stddev == 0:
                c["z_score"] = 0.0
                c["tier"] = "A"
                continue
            z = (c["winrate"] - mean) / stddev
            c["z_score"] = round(z, 2)
            if z >= 2.0:    c["tier"] = "S+"
            elif z >= 1.0:  c["tier"] = "S"
            elif z >= 0.0:  c["tier"] = "A"
            elif z >= -1.0: c["tier"] = "B"
            elif z >= -2.0: c["tier"] = "C"
            else:           c["tier"] = "D"

    for role_items in by_role.values():
        _assign_tiers(role_items)

    return result_list


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
    Tenta servir do cache R2 (via stats_cache) quando patch e especificado e server nao.
    """
    # ── Tentativa via cache R2 ─────────────────────────────────────────
    if patch and not server:
        try:
            from backend.services.stats_cache import get_champion_stats
            cache_data = get_champion_stats(patch)
            if cache_data:
                champions_raw = cache_data.get("champions") or []
                champ_lower = champion.lower()
                matching = [
                    c for c in champions_raw
                    if c.get("champion", "").lower() == champ_lower
                    and (not role or c.get("role") == role.upper())
                ]
                total = sum(c["total_matches"] for c in matching)
                if total < min_matches:
                    return {
                        "champion": champion,
                        "filters": {"role": role, "server": server, "patch": patch},
                        "total_matches": total,
                        "stats": None,
                    }
                wins = sum(c["wins"] for c in matching)

                def wavg(field: str) -> float:
                    weighted = sum(c.get(field, 0) * c["total_matches"] for c in matching)
                    return weighted / total

                return {
                    "champion": champion,
                    "filters": {"role": role, "server": server, "patch": patch},
                    "total_matches": total,
                    "stats": {
                        "winrate": round(wins / total * 100, 2),
                        "avg_kills": round(wavg("avg_kills"), 2),
                        "avg_deaths": round(wavg("avg_deaths"), 2),
                        "avg_assists": round(wavg("avg_assists"), 2),
                        "avg_gold": round(wavg("avg_gold"), 0),
                        "avg_damage_per_minute": round(wavg("avg_damage_per_minute"), 1),
                        "avg_kill_participation": round(wavg("avg_kill_participation"), 3),
                    },
                }
        except Exception as e:
            logger.warning("buscar_stats_campeao: cache falhou, usando Supabase: %s", e)

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

    # ── Tentativa via cache R2 (patch ou patch_list especificados) ─────
    if patch and not patch_list:
        try:
            from backend.services.stats_cache import get_champion_stats
            cache_data = get_champion_stats(patch)
            if cache_data is not None:
                result = _build_tierlist_from_cache(
                    cache_data, role, server,
                    min_matches, min_role_share, min_matches_relative,
                )
                if result is not None:
                    _cache_set(cache_key, result)
                    logger.info("[cache] tierlist R2 hit patch=%s: %d entradas", patch, len(result))
                    return result
        except Exception as e:
            logger.warning("buscar_tierlist: cache R2 falhou, usando Supabase: %s", e)

    if patch_list:
        try:
            from backend.services.stats_cache import get_champion_stats
            merged_rows: list[dict] = []
            total_matches_agg = 0
            ban_counts_agg: dict[str, int] = defaultdict(int)
            for p in patch_list:
                cd = get_champion_stats(p)
                if cd is None:
                    merged_rows = []
                    break
                merged_rows.extend(cd.get("champions") or [])
                total_matches_agg += cd.get("total_unique_matches") or 0
                for champ, cnt in (cd.get("ban_counts") or {}).items():
                    ban_counts_agg[champ] += cnt
            if merged_rows:
                merged_data = {
                    "total_unique_matches": total_matches_agg or 1,
                    "ban_counts": dict(ban_counts_agg),
                    "champions": merged_rows,
                }
                result = _build_tierlist_from_cache(
                    merged_data, role, server,
                    min_matches, min_role_share, min_matches_relative,
                )
                if result is not None:
                    _cache_set(cache_key, result)
                    logger.info("[cache] tierlist R2 hit patch_list=%s: %d entradas", patch_list, len(result))
                    return result
        except Exception as e:
            logger.warning("buscar_tierlist: cache R2 (patch_list) falhou, usando Supabase: %s", e)

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
