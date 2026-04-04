# Diagrama do Sistema — Metis
*Última atualização: 2026-04-04 — v0.7.2*

---

## 1. Arquitetura Geral (Fluxo de Dados)

```mermaid
flowchart TD
    subgraph FONTES["Fontes Externas"]
        RIOT["Riot API\n(RiotWatcher)"]
        MOBAFIRE["Mobafire\n(Playwright)"]
        DDRAGON["Data Dragon\n(DDragon CDN)"]
    end

    subgraph ACTIONS["GitHub Actions (CI/CD)"]
        A1["fetch_high_elo_matches\ncron: 03:00 UTC diário"]
        A2["fetch_pro_players\ncron: 1º e 15 de cada mês"]
        A3["fetch_pro_matches\ncron: 22:00 UTC a cada 2 dias"]
        A4["fetch_guides\ncron: 04:00 UTC a cada 3 dias"]
        A5["update_static_data\nmanual"]
        A6["process_matches\ncron: 14:00 UTC diário"]
        A7["process_timelines\ncron: 15:00 UTC diário"]
    end

    subgraph BRONZE["☁️ Cloudflare R2 (Bronze)"]
        R2M["matches/{id}.json.gz"]
        R2T["timelines/{id}.json.gz"]
        R2G["guides/{champ_autor}.json.gz"]
        R2S["static/champion.json\nstatic/item.json"]
    end

    subgraph SILVER["🗄️ Supabase PostgreSQL (Silver)"]
        direction TB
        DB1["players"]
        DB2["matches"]
        DB3["match_participants"]
        DB4["matches_dirty"]
        DB5["participant_snapshots"]
        DB6["critical_events"]
        DB7["champion_builds"]
        DB8["match_timelines"]
        DB9["processed_matches\nprocessed_timelines"]
        DB10["watched_players\n(RLS por user_id)"]
        DB11["pro_players"]
    end

    subgraph GOLD["✨ Supabase Gold (pgvector)"]
        DB12["guides_gold\nembedding vector(1536)"]
    end

    subgraph BACKEND["⚙️ FastAPI (Railway)"]
        API["Metis API\n:8000"]
    end

    subgraph FRONTEND["🖥️ Next.js (Vercel)"]
        FE["Metis Web\n:3000"]
    end

    subgraph AI["🤖 IA (pendente M4)"]
        OLLAMA["Ollama\nLlama 3"]
        LANGFLOW["Langflow\nOpenRAG"]
    end

    RIOT --> A1 & A3
    MOBAFIRE --> A4
    DDRAGON --> A5

    A1 & A2 & A3 --> R2M
    A4 --> R2G
    A5 --> R2S

    A6 --> |"lê R2M, filtra,\nescreve Silver"| SILVER
    A7 --> |"lê R2T, filtra,\nescreve Silver"| SILVER

    R2M --> A6
    R2T --> A7

    SILVER --> |"SELECT"| API
    API --> |"UPSERT via\nriot_service"| SILVER
    API --> |"lazy cache timeline"| DB8

    API --> |"JSON"| FE
    FE --> |"Supabase Auth\ncookies SSR"| DB10

    R2G -.->|"vectorize_guides\n(pendente)"| DB12
    DB12 -.->|"busca semântica"| LANGFLOW
    LANGFLOW -.-> OLLAMA
    OLLAMA -.->|"/api/v1/chat"| API
```

---

## 2. Banco de Dados — Tabelas e Relacionamentos

```mermaid
erDiagram
    pro_players {
        serial id PK
        varchar official_name
        varchar team
        varchar primary_role
        varchar region
        boolean is_active
    }

    players {
        varchar puuid PK
        int pro_player_id FK
        varchar game_name
        varchar tag_line
        varchar server
        varchar tier
        int profile_icon_id
        timestamp last_updated
        timestamp last_synced_at
    }

    matches {
        varchar match_id PK
        varchar game_version
        int game_duration
        int queue_id
        varchar end_type
        timestamp created_at
        bigint game_end_timestamp
    }

    matches_dirty {
        varchar match_id PK
        varchar reason
        jsonb snapshot
        timestamp created_at
    }

    match_participants {
        bigserial id PK
        varchar match_id FK
        varchar puuid FK
        varchar champion_name
        varchar team_position
        int team_id
        boolean win
        int kills
        int deaths
        int assists
        int gold_earned
        int total_damage_dealt_to_champions
        int vision_score
        float kill_participation
        float damage_per_minute
        int total_cs
        float cs_per_minute
        int champion_level
        jsonb items
        varchar rune_keystone
        int summoner1_id
        int summoner2_id
    }

    participant_snapshots {
        bigserial id PK
        varchar match_id FK
        varchar puuid FK
        int timestamp_minute
        int level
        int total_gold
        int minions_killed
        int jungle_minions_killed
        int champion_damage_done
    }

    critical_events {
        bigserial id PK
        varchar match_id FK
        int timestamp
        varchar event_type
        varchar primary_participant_id FK
        varchar secondary_participant_id
        text[] assisting_participant_ids
        jsonb details
        int position_x
        int position_y
    }

    champion_builds {
        bigserial id PK
        varchar champion_name
        int item_id
        varchar item_name
        varchar patch
        int pick_count
        int win_count
    }

    match_timelines {
        varchar match_id PK
        jsonb frames
    }

    processed_matches {
        varchar match_id PK
    }

    processed_timelines {
        varchar match_id PK
    }

    watched_players {
        uuid user_id PK
        varchar puuid PK
        varchar label
    }

    guides_gold {
        serial id PK
        varchar champion
        varchar title
        varchar author
        text content
        vector embedding
    }

    pro_players ||--o{ players : "pro_player_id"
    players ||--o{ match_participants : "puuid"
    players ||--o{ participant_snapshots : "puuid"
    players ||--o{ critical_events : "primary_participant_id"
    matches ||--o{ match_participants : "match_id"
    matches ||--o{ participant_snapshots : "match_id"
    matches ||--o{ critical_events : "match_id"
    matches ||--o| match_timelines : "match_id"
```

### Views SQL
| View | Tabela base | Calcula |
|------|------------|---------|
| `champion_item_stats` | `champion_builds` | `winrate_pct = win_count / pick_count` |

### Tabelas de controle ETL (Bronze → Silver)
| Tabela | Uso |
|--------|-----|
| `processed_matches` | Idempotência — evita reprocessar match já inserido |
| `processed_timelines` | Idempotência — evita reprocessar timeline já inserida |

---

## 3. API Endpoints — FastAPI (Railway)

### Player `/api/v1/player`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/update-history` | — | Busca PUUID + sincroniza N partidas do jogador via Riot API |
| POST | `/sync` | — | Alias de update-history, recebe `riot_id = Nome#Tag` |
| GET | `/history` | — | Histórico paginado (`?puuid&limit&offset`) — retorna `has_more` |

### Match `/api/v1/match`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/{match_id}` | — | Scoreboard completo (blue_team, red_team, max_damage, has_timeline) |
| GET | `/{match_id}/timeline` | — | Frames CS/m, Gold, XP por minuto — cache hit em `match_timelines`, miss chama Riot API |

### Stats `/api/v1/stats`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/champions` | — | Stats médias de um campeão (`?champion&role&server&patch&min_matches`) |
| GET | `/tierlist` | — | Todos os campeões ordenados por winrate (`?role&server&patch&min_matches`) |

### Champion `/api/v1/champion`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/{champion}/overview` | — | Winrate, KDA, DPM, CS/m, KP, gold (`?role&server&patch&min_matches`) |
| GET | `/{champion}/builds` | — | Itens mais frequentes com winrate (via view `champion_item_stats`) |
| GET | `/{champion}/matchups` | — | Winrate contra cada oponente na mesma lane |
| GET | `/{champion}/synergies` | — | Winrate com aliados na mesma partida |

### Admin `/api/v1/admin`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/stats` | `Bearer JWT` + `is_admin=true` | Contagens do sistema — players, matches, dirty, timelines, syncs 24h/7d |

### Root
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/v1/health` | — | `{"status":"online","system":"Metis"}` |
| POST | `/api/v1/ingestion/fetch-matches` | — | Dispara ingestão Bronze via API (R2) |
| POST | `/api/v1/chat` | — | **Skeleton** — aguarda integração Llama 3 + OpenRAG |

---

## 4. Frontend — Páginas e Dependências de API

```mermaid
flowchart LR
    subgraph PAGES["Next.js Pages (Vercel)"]
        P1["/\nHome + busca"]
        P2["/auth\nLogin"]
        P3["/players/puuid\nPerfil do Jogador"]
        P4["/matches/match_id\nScoreboard"]
        P5["/champions\nTier List"]
        P6["/champions/champion\nPágina do Campeão"]
        P7["/chat\nIA Tática 🔒premium"]
        P8["/admin\nPainel Admin 🔒admin"]
        P9["/changelog"]
        P10["/team"]
    end

    subgraph API["FastAPI Endpoints"]
        E1["POST /player/sync"]
        E2["GET /player/history"]
        E3["GET /match/:id"]
        E4["GET /match/:id/timeline"]
        E5["GET /stats/tierlist"]
        E6["GET /champion/:c/overview\n/builds /matchups /synergies"]
        E7["POST /chat"]
        E8["GET /admin/stats"]
        E9["Supabase watched_players\n(direto via supabase-js)"]
    end

    P1 --> E1 & E9
    P3 --> E1 & E2 & E9
    P4 --> E3 & E4
    P5 --> E5
    P6 --> E6
    P7 --> E7
    P8 --> E8
```

### Modelo de Acesso
| Rota | Anon | Login | Login + Premium | Admin |
|------|:----:|:-----:|:---------------:|:-----:|
| `/` | ✅ | ✅ | ✅ | ✅ |
| `/auth` | ✅ | → `/` | → `/` | → `/` |
| `/players/[puuid]` | ✅ | ✅ | ✅ | ✅ |
| `/matches/[match_id]` | ✅ | ✅ | ✅ | ✅ |
| `/champions` | ✅ | ✅ | ✅ | ✅ |
| `/champions/[champion]` | ✅ | ✅ | ✅ | ✅ |
| `/changelog` + `/team` | ✅ | ✅ | ✅ | ✅ |
| `/chat` | ❌ | gate premium | ✅ | ✅ |
| `/admin` | ❌ | ❌ | ❌ | ✅ |

---

## 5. GitHub Actions — Workflows e Agendamento

```mermaid
gantt
    title GitHub Actions — Janela Diária (UTC)
    dateFormat HH:mm
    axisFormat %H:%M

    section Ingestão Bronze
    fetch_high_elo_matches (diário)   : 03:00, 5h40m
    fetch_pro_matches (2 em 2 dias)   : 22:00, 2h

    section Processamento Silver
    process_matches (diário)          : 14:00, 1h
    process_timelines (diário)        : 15:00, 1h
```

| Workflow | Cron (UTC) | Timeout | Script |
|----------|-----------|---------|--------|
| `fetch_high_elo_matches` | `0 3 * * *` — diário | 280 min | `scripts/ingestion/fetch_high_elo_matches.py` |
| `fetch_pro_players` | `0 4 1,15 * *` — quinzenal | — | `scripts/ingestion/fetch_pro_players.py` |
| `fetch_pro_matches` | `0 22 */2 * *` — a cada 2 dias | — | `scripts/ingestion/fetch_pro_matches.py` |
| `fetch_guides` | `0 4 */3 * *` — a cada 3 dias | 240 min | `scripts/ingestion/fetch_guides.py` |
| `process_matches` | `0 14 * * *` — diário | 60 min | `scripts/processing/process_matches.py` |
| `process_timelines` | `0 15 * * *` — diário | 60 min | `scripts/processing/process_timelines.py` |

### Secrets necessários no GitHub
| Secret | Usado por |
|--------|-----------|
| `RIOT_API_KEY` | fetch_high_elo, fetch_pro_matches |
| `SUPABASE_URL` | process_matches, process_timelines |
| `SUPABASE_KEY` | process_matches, process_timelines |
| `R2_ACCOUNT_ID` | todos os workflows |
| `R2_ACCESS_KEY_ID` | todos os workflows |
| `R2_SECRET_ACCESS_KEY` | todos os workflows |

---

## 6. Cloudflare R2 — Estrutura de Pastas (Bronze)

```
metis/                          ← bucket
├── matches/
│   └── BR1_3225XXXXXX.json.gz  ← JSON bruto da Riot API (match)
├── timelines/
│   └── BR1_3225XXXXXX.json.gz  ← JSON bruto da Riot API (timeline)
├── guides/
│   └── ahri_peng04.json.gz     ← Guia scrapeado do Mobafire
└── (static data gerenciado localmente em data/static/)
```

---

## 7. Eventos Capturados em critical_events

| `event_type` | `primary_participant_id` | `secondary_participant_id` | `assisting_participant_ids` | `details` |
|---|---|---|---|---|
| `CHAMPION_KILL` | PUUID do killer | PUUID da vítima | Array de PUUIDs | `null` |
| `ELITE_MONSTER_KILL` | PUUID do killer | `null` | `null` | `{monsterType, monsterSubType}` |
| `BUILDING_KILL` | PUUID do killer | `null` | `null` | `{buildingType, laneType, towerType, teamId}` |

---

## 8. Serviços e Tecnologias

| Serviço | Tecnologia | Onde |
|---------|-----------|------|
| Frontend | Next.js 15 + React 19 + Tailwind CSS v3 | Vercel |
| Backend API | FastAPI (Python 3.12) + Pydantic | Railway (Docker) |
| Banco Estruturado | PostgreSQL 17 | Supabase |
| Busca Vetorial | pgvector (nativo Supabase) | Supabase |
| RAG Orchestration | OpenRAG (Langflow + Docling) | pendente M4 |
| LLM | Llama 3 via Ollama | pendente M4 |
| Data Lake | Cloudflare R2 (S3-compatible) | Cloudflare |
| Auth | Supabase Auth (email/senha) + SSR cookies | Supabase |
| Scraper | Playwright + BeautifulSoup | GitHub Actions |
| Processamento | Python Polars | GitHub Actions |
| CI/CD | GitHub Actions | GitHub |
