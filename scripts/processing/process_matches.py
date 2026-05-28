import os
import json
import gzip
import io
import logging
from pathlib import Path

_logger = logging.getLogger(__name__)
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 50))

# Queues aceitas: Ranked Solo (420) e Ranked Flex (440)
VALID_QUEUE_IDS = {420, 440}


# 
# DICIONRIO DE ITENS  carregado uma vez, reutilizado em toda a run
# 

_ITEM_DICT: dict[int, str] | None = None
_ITEM_JSON_PATH = Path(__file__).parents[2] / "data" / "static" / "item.json"


def _get_item_dict() -> dict[int, str]:
    """Carrega data/static/item.json com lazy cache. {item_id: item_name}"""
    global _ITEM_DICT
    if _ITEM_DICT is None:
        if not _ITEM_JSON_PATH.exists():
            _logger.warning(f"  item.json no encontrado em {_ITEM_JSON_PATH}. Builds sero ignoradas.")
            _ITEM_DICT = {}
        else:
            with open(_ITEM_JSON_PATH, encoding="utf-8") as f:
                raw = json.load(f)
            _ITEM_DICT = {int(k): v["name"] for k, v in raw.get("data", {}).items()}
    return _ITEM_DICT


# 
# PARSING PURO  sem I/O, sem banco, totalmente testvel
# 

def _normalizar_patch(game_version: str) -> str:
    """'14.10.123.456' -> '14.10'"""
    parts = (game_version or "").split(".")
    if len(parts) >= 2:
        return f"{parts[0]}.{parts[1]}"
    return game_version or "unknown"


def extrair_dados_partida(match_json: dict) -> tuple[dict | None, list, list]:
    """
    Parsing puro do JSON bruto da Riot.
    Aplica todos os filtros de limpeza sem tocar no banco.

    Retorna:
        match_payload: dict | None   None se a partida deve ser descartada
        players_payload: list[dict]
        participants_payload: list[dict]
    """
    metadata = match_json.get("metadata", {})
    info = match_json.get("info", {})

    match_id = metadata.get("matchId")
    if not match_id or not info:
        return None, [], []

    #  Filtro 1: Durao mnima (remake / queda de servidor) 
    game_duration = info.get("gameDuration", 0)
    if game_duration < 190:
        _logger.debug(f"  {match_id}: Descartado  durao {game_duration}s (remake).")
        return None, [], []

    #  Filtro 2: Queue vlida (s Ranked Solo/Flex) 
    queue_id = info.get("queueId", 0)
    if queue_id not in VALID_QUEUE_IDS:
        _logger.debug(f"  {match_id}: Descartado  queue {queue_id} (no  ranked).")
        return None, [], []

    #  Filtro 3: Partida com exatamente 10 participantes 
    participants_raw = info.get("participants", [])
    if len(participants_raw) != 10:
        _logger.debug(f"  {match_id}: Descartado  {len(participants_raw)} participantes (corrompido).")
        return None, [], []

    #  Montar payload da partida 
    end_type = "normal"
    if info.get("gameEndedInEarlySurrender"):
        end_type = "early_ff"
    elif info.get("gameEndedInSurrender"):
        end_type = "late_ff"

    match_payload = {
        "match_id": match_id,
        "game_version": _normalizar_patch(info.get("gameVersion", "")),
        "game_duration": game_duration,
        "queue_id": queue_id,
        "end_type": end_type,
    }

    #  Montar payloads de jogadores e participantes 
    players_payload = []
    participants_payload = []

    for p in participants_raw:
        puuid = p.get("puuid", "")

        #  Filtro 4: Bots 
        if not puuid or puuid.startswith("BOT_") or p.get("botPlayer", False):
            print(f"    Bot detectado em {match_id}  participante ignorado.")
            continue

        players_payload.append({
            "puuid": puuid,
            "game_name": p.get("riotIdGameName", "Desconhecido"),
            "tag_line": p.get("riotIdTagline", "UNK"),
            "profile_icon_id": p.get("profileIcon"),
        })

        #  Filtro 5: teamPosition vazia -> UNKNOWN 
        team_position = p.get("teamPosition") or "UNKNOWN"

        time_played = p.get("timePlayed", game_duration)
        is_afk = p.get("teamEarlySurrendered", False) or (time_played < game_duration * 0.8)
        challenges = dict(p.get("challenges", {}))
        challenges["is_afk"] = is_afk

        #  Items (slots 0-6, slot 6 = trinket) 
        items = [p.get(f"item{i}", 0) for i in range(7)]

        #  Runas 
        perks = p.get("perks", {})
        styles = perks.get("styles", [])
        primary       = styles[0] if styles else {}
        secondary     = styles[1] if len(styles) > 1 else {}
        primary_sels  = primary.get("selections") or []
        keystone      = primary_sels[0].get("perk") if primary_sels else None

        #  CS e CS/min 
        total_cs = p.get("totalMinionsKilled", 0) + p.get("neutralMinionsKilled", 0)
        cspm = round(total_cs / (game_duration / 60), 2) if game_duration > 0 else 0.0

        participants_payload.append({
            "match_id": match_id,
            "puuid": puuid,
            "champion_name": p.get("championName"),
            "team_position": team_position,
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
            # challenges JSONB removido pra economizar espaco
            #  Campos enriquecidos (v0.6.4) 
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

    return match_payload, players_payload, participants_payload


def extrair_builds_partida(match_json: dict, item_dict: dict[int, str]) -> list[dict]:
    """
    Extrai as builds de itens de cada participante da partida.
    Funo pura  sem I/O, sem banco.

    Retorna lista de registros prontos para a tabela champion_builds:
        [{champion_name, item_id, item_name, patch, pick_count, win_count}, ...]

    Regras:
    - Slots zerados (item_id == 0) so ignorados.
    - item_id ausente no item_dict  ignorado (ward, token de misso, etc.).
    - Bots j filtrados em extrair_dados_partida no chegam aqui.
    """
    metadata = match_json.get("metadata", {})
    info = match_json.get("info", {})

    if not metadata.get("matchId") or not info:
        return []

    patch = _normalizar_patch(info.get("gameVersion", ""))
    item_slots = ["item0", "item1", "item2", "item3", "item4", "item5"]
    builds: list[dict] = []

    for p in info.get("participants", []):
        puuid = p.get("puuid", "")
        if not puuid or puuid.startswith("BOT_") or p.get("botPlayer", False):
            continue

        champion = p.get("championName")
        won = bool(p.get("win"))
        role = (p.get("teamPosition") or "UNKNOWN").upper() or "UNKNOWN"

        for slot in item_slots:
            item_id = p.get(slot, 0)
            if not item_id:
                continue
            item_name = item_dict.get(item_id)
            if not item_name:
                continue

            builds.append({
                "champion_name": champion,
                "item_id": item_id,
                "item_name": item_name,
                "patch": patch,
                "role": role,
                "pick_count": 1,
                "win_count": 1 if won else 0,
            })

    return builds


# 
# PERSISTNCIA  depende do db_client injetvel
# 

def processar_partida(match_json: dict, db_client=None) -> bool:
    """
    Processa e persiste uma partida no Supabase.

    Args:
        match_json: JSON bruto da Riot Match API.
        db_client: cliente Supabase injetvel. Se None, cria usando variveis de ambiente.
    """
    match_payload, players_payload, participants_payload = extrair_dados_partida(match_json)

    if match_payload is None:
        return False

    if db_client is None:
        from supabase import create_client
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERRO: Credenciais do Supabase no encontradas no .env!")
            return False
        db_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    match_id = match_payload["match_id"]
    try:
        db_client.table("matches").upsert(match_payload).execute()
        if players_payload:
            db_client.table("players").upsert(players_payload).execute()
        if participants_payload:
            # on_conflict garante que re-runs no criam duplicatas (UNIQUE match_id, puuid)
            db_client.table("match_participants").upsert(
                participants_payload, on_conflict="match_id,puuid"
            ).execute()

        builds = extrair_builds_partida(match_json, _get_item_dict())
        if builds:
            # RPC atomic: INSERT  ON CONFLICT DO UPDATE SET pick_count += 1, win_count += won
            db_client.rpc("upsert_champion_builds", {"builds": builds}).execute()

        _logger.debug(f" {match_id}: Salvo ({match_payload['end_type']}, patch {match_payload['game_version']}, {len(builds)} builds).")
        return True
    except Exception as e:
        _logger.error(f" {match_id}: Erro ao salvar  {e}")
        return False


# 
# LOOP DO R2  lista, baixa, processa, marca
# 

def _get_processed_ids(db_client) -> set:
    """Retorna os match_ids j processados registrados no Supabase.
    Usa paginao para no ser limitado pelo teto de 1000 linhas do PostgREST.
    """
    try:
        ids: set[str] = set()
        page_size = 1000
        offset = 0
        while True:
            result = (
                db_client.table("processed_matches")
                .select("match_id")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            batch = result.data or []
            for row in batch:
                ids.add(row["match_id"])
            if len(batch) < page_size:
                break
            offset += page_size
        return ids
    except Exception as e:
        _logger.warning(f"  No foi possvel buscar processed_matches: {e}")
        return set()


def _marcar_processado(db_client, match_id: str) -> None:
    """Registra o match_id como processado."""
    try:
        db_client.table("processed_matches").upsert({"match_id": match_id}).execute()
    except Exception as e:
        _logger.warning(f"  Falha ao marcar {match_id} como processado: {e}")


def _listar_keys_r2(s3_client, bucket: str, prefix: str = "matches/") -> list[str]:
    """Lista todas as keys do bucket R2 com o prefixo dado."""
    keys = []
    paginator = s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


def _baixar_e_descomprimir(s3_client, bucket: str, key: str) -> dict | None:
    """Baixa e descomprime um .gz do R2, retorna o dict JSON."""
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        compressed = response["Body"].read()
        with gzip.open(io.BytesIO(compressed), "rt", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        _logger.error(f" Falha ao baixar {key}: {e}")
        return None


def rodar_pipeline(s3_client=None, db_client=None, batch_size: int = BATCH_SIZE) -> dict:
    """
    Loop principal Bronze -> Prata.
    Lista partidas do R2, filtra as j processadas, processa em batch.

    Retorna relatrio: {"processadas": int, "descartadas": int, "erros": int}
    """
    from scripts.utils.r2_storage import get_r2_client
    from supabase import create_client

    if s3_client is None:
        s3_client = get_r2_client()
    if s3_client is None:
        print("ERRO: R2 client no disponvel.")
        return {"processadas": 0, "descartadas": 0, "erros": 0}

    if db_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERRO: Credenciais do Supabase no encontradas.")
            return {"processadas": 0, "descartadas": 0, "erros": 0}
        db_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    bucket = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "metis")

    print("Lista: Buscando partidas j processadas no Supabase...")
    processed_ids = _get_processed_ids(db_client)
    print(f"   {len(processed_ids)} partidas j processadas.")

    print("Listando Listando partidas no R2...")
    all_keys = _listar_keys_r2(s3_client, bucket, prefix="matches/")
    print(f"   {len(all_keys)} arquivos encontrados no R2.")

    # Filtra apenas as no processadas, extrai match_id da key (matches/BR1_123.json.gz)
    pendentes = [
        k for k in all_keys
        if k.replace("matches/", "").replace(".json.gz", "") not in processed_ids
    ]
    print(f"   {len(pendentes)} pendentes. Processando batch de {batch_size}...")

    batch = pendentes[:batch_size]
    stats = {"processadas": 0, "descartadas": 0, "erros": 0}

    for i, key in enumerate(batch, 1):
        match_id = key.replace("matches/", "").replace(".json.gz", "")
        _logger.debug(f"[{i}/{len(batch)}] {match_id}", end="  ")

        match_json = _baixar_e_descomprimir(s3_client, bucket, key)
        if match_json is None:
            stats["erros"] += 1
            _marcar_processado(db_client, match_id)  # no tentar de novo
            continue

        ok = processar_partida(match_json, db_client=db_client)
        if ok:
            stats["processadas"] += 1
        else:
            stats["descartadas"] += 1

        _marcar_processado(db_client, match_id)

    print(f"\nResultado: Resultado: {stats}")
    return stats


# 
# ENTRYPOINT
# 

if __name__ == "__main__":
    rodar_pipeline()
