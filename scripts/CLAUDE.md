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

| Script | Status | Bloqueio |
|--------|--------|----------|
| `fetch_matches.py` | ✅ Operacional | — |
| `fetch_high_elo_matches.py` | ✅ Existe | Não testado em Actions |
| `fetch_pro_players.py` | ✅ Existe | Não testado em Actions |
| `fetch_pro_matches.py` | ✅ Existe | Não testado em Actions |
| `fetch_guides.py` | 🟡 Parcial | Playwright via Actions + bugfix |
| `process_matches.py` | 🟡 Parcial | Falta loop + Action + bugfix |
| `process_timelines.py` | 🟡 Parcial | Falta loop + Action |
| `update_static_data.py` | ✅ Existe | — |

## Próximo Passo (Ticket Ativo M2)

**Script de Limpeza Bronze → Prata (`process_matches.py`)**
- Montar o loop de processamento
- Subir como GitHub Action com schedule
- Bugfix de erros conhecidos

## Testes

```bash
pytest tests/ -v -k "pipeline"
```

Mocks de banco para TDD ficam em `tests/` na raiz. Simule o R2 com `moto` (S3 mock) e Supabase com fixtures.
