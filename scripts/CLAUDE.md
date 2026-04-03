# CLAUDE.md — Scripts (Data Pipeline)

> Contexto específico para trabalho nos `/scripts`. Leia também o `CLAUDE.md` da raiz.

## Responsável Principal: César (Tech Lead / Data Architect)

## Arquitetura Medalhão

```
Bronze (Cloudflare R2)   →   Silver (Supabase)   →   Gold (Supabase pgvector + OpenRAG)
    JSONs brutos .gz           Dados limpos               Vetores + busca híbrida
    fetch_*.py                 process_*.py               (pipeline OpenRAG/Docling)
```

## Estrutura

```
scripts/
├── ingestion/
│   ├── fetch_matches.py          # Riot API — partidas ranqueadas (RiotWatcher)
│   ├── fetch_high_elo_matches.py # Partidas de jogadores high-elo
│   ├── fetch_pro_players.py      # Lista de pro players Challenger
│   ├── fetch_pro_matches.py      # Partidas dos pro players
│   ├── fetch_guides.py           # Scraper Mobafire/Probuilds (Playwright)
│   └── update_static_data.py     # Data Dragon (campeões, itens, patches)
└── processing/
    ├── process_matches.py        # Bronze → Silver: limpeza de partidas
    └── process_timelines.py      # Bronze → Silver: limpeza de timelines
```

## Regras Específicas dos Scripts

### Ingestão (Bronze)
- Dados brutos são salvos no **Cloudflare R2** em formato `.gz` (compressão obrigatória para economizar espaço/egress).
- Nunca reprocesse uma partida já existente no R2 — cheque existência antes de baixar (idempotência).
- Rate limit da Riot API: respeite os limites por segundo e por 2 minutos. Use backoff exponencial.
- O identificador imutável de jogador é o **PUUID** — nunca use `summonerId` como chave primária.

### Processamento (Silver)
- Use **Polars** (não Pandas) para transformações massivas.
- Filtre partidas inválidas antes de inserir no Supabase:
  - Duração < 5 minutos (remakes)
  - Jogadores com `afk: true`
  - Partidas não ranqueadas (se o escopo for só ranked)
- Inserções no Supabase devem ser **em bloco (bulk upsert)**, nunca linha por linha.
- Use **upsert** (insert + on conflict update) para garantir idempotência.

### GitHub Actions (CI/CD)
- Todo script de ingestão/processamento deve ser executável como GitHub Action.
- Variáveis sensíveis vêm de **GitHub Secrets**, nunca hardcodadas.
- Actions de ingestão rodam agendadas (cron) — documente o schedule no YAML.

## Status dos Scripts (M2)

| Script | Status | Observação |
|--------|--------|------------|
| `fetch_matches.py` | ✅ Operacional | — |
| `fetch_high_elo_matches.py` | ✅ Operacional | MAX_PLAYERS_PER_TIER cap + Diamond removido do cron diário |
| `fetch_pro_players.py` | ✅ Existe | Não testado em Actions |
| `fetch_pro_matches.py` | ✅ Existe | Não testado em Actions |
| `fetch_guides.py` | 🟡 Parcial | Playwright via Actions + bugfix pendente |
| `process_matches.py` | ✅ Operacional | Loop R2 + Action + builds de itens + 31 testes |
| `process_timelines.py` | 🟡 Parcial | Lógica pronta, falta loop + GitHub Action |
| `update_static_data.py` | ✅ Existe | — |

## Convenções de process_matches.py

- `extrair_dados_partida(match_json)` — parsing puro, retorna `(match_payload, players_payload, participants_payload)`
- `extrair_builds_partida(match_json, item_dict)` — parsing puro de builds, retorna lista de registros para `champion_builds`
- `processar_partida(match_json, db_client=None)` — persiste tudo (matches + players + participants + builds via RPC)
- `rodar_pipeline(...)` — loop Bronze→Silver: lista R2, filtra `processed_matches`, processa batch
- `_get_item_dict()` — lazy cache do `data/static/item.json`, lido uma vez por processo

## Filtros da Camada Prata (process_matches.py)

| Filtro | Regra |
|--------|-------|
| Duração | < 190s → descarta (remake) |
| Queue | Só 420 (Ranked Solo) e 440 (Ranked Flex) |
| Participantes | Exatamente 10 |
| Bots | `botPlayer=True` ou `puuid` vazio/`BOT_` → ignora participante |
| teamPosition | Vazio/None → `"UNKNOWN"` |
| game_version | Normalizado para "major.minor" (ex: "14.10") |
| Itens | Slot 0 e IDs fora do `item.json` → ignorados silenciosamente |

> **Threshold 190s vs 900s:** `process_matches.py` usa 190s (remake filter — pipeline batch). `riot_service.py` usa 900s (15 min — sync on-demand por jogador). Diferença intencional por contexto de uso.

## Testes

```bash
pytest tests/ -v
```

| Arquivo de Teste | Cobre |
|-----------------|-------|
| `test_process_matches.py` | Filtros, normalização, persistência mock (31 testes) |
| `test_process_builds.py` | `extrair_builds_partida` — slots, bots, win/loss (16 testes) |
