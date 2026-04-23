# Plano de Backend — Decisões Pendentes

*Autor: Claude Code · Data: 2026-04-23 · Versão frontend atual: p-0.9.22*

Este documento consolida os tickets de backend que o bundle do Claude Design (`.speckit/handoffs/metis-1-0/HANDOFF-TECNICO.md`) deixou em aberto. Frontend puro já foi entregue (p-0.9.20 a p-0.9.22) — os próximos passos exigem decisões arquiteturais do César (Data Architect) e André (Backend & AI).

---

## Dependências entre tickets

```
                                    ┌────────────────┐
                                    │ Bloco 0 (v0.9.0)│
                                    │ ETL de eventos  │
                                    │ da timeline     │
                                    └───┬────────────┘
                                        │
                ┌───────────────────────┼──────────────────────┐
                ▼                       ▼                      ▼
    ┌──────────────────┐   ┌────────────────────┐   ┌──────────────────┐
    │ Bloco 0 (cont.)  │   │ p-0.9.23           │   │ p-0.9.22 backend │
    │ Timeline interat.│   │ AI Insights        │   │ Radar v2         │
    │ (mapa + scrubber)│   │ (match analysis    │   │ (z-score eixos + │
    └──────────────────┘   │  usa critical_     │   │  perfil ideal)   │
                           │  events)           │   └──────────────────┘
                           └────────────────────┘

    ┌──────────────────┐
    │ p-0.9.24         │   (independente de Bloco 0, depende de
    │ Champion v2      │    decisão sobre scraping/ETL de abilities)
    │ (dados do champ) │
    └──────────────────┘
```

**Caminho crítico sugerido**: Bloco 0 primeiro (desbloqueia timeline + AI insights profundos). Radar v2 e Champion v2 podem ir em paralelo.

---

## Ticket A — Bloco 0 (v0.9.0): ETL de eventos da timeline

**Status atual**: Riot Match-V5 Timeline é buscada e salva em R2 (bronze), mas **os eventos nunca são parseados**. A tabela `critical_events` existe no schema (v0.7.2) mas só armazena kills com vítima+assists, monstros e torres — shape simples, sem estrutura rica.

**O que desbloqueia**:
- Timeline interativa em `/matches/[id]` (HANDOFF seção 1)
- Campo `eventIds` em Match Deep Analysis (AI liga análise com momentos)
- KILL_HEATMAP pré-calculado pra minimap
- xpCurve por minuto pra detectar viradas

### Escopo mínimo (scripts/processing/)

Novo script `process_timeline_events.py` que roda a partir do bronze R2 e popula uma tabela Postgres nova `match_timeline_events`:

```sql
CREATE TABLE match_timeline_events (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches_clean(match_id) ON DELETE CASCADE,
  t_seconds INT NOT NULL,          -- derivado do frame.timestamp
  type TEXT NOT NULL,              -- 'kill'|'teamfight'|'dragon'|'herald'|'baron'|'tower'|'ward'|'level'|'item'
  x SMALLINT,                      -- 0..100, convertido de riot (0..14999)
  y SMALLINT,
  key_moment BOOLEAN NOT NULL DEFAULT FALSE,
  gold INT,
  team SMALLINT,                   -- 100 (blue) | 200 (red) | NULL
  payload JSONB NOT NULL,          -- detalhes específicos do type (killer/victim/assists, drakeType, etc)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON match_timeline_events (match_id, t_seconds);
CREATE INDEX ON match_timeline_events USING GIN (payload);
```

### Decisões tomadas (2026-04-23)

| # | Tema | Decisão |
|---|------|---------|
| A1 | Onde roda o ETL | ✅ **(a) GitHub Action semanal** — mesmo padrão do `process_matches` |
| A2 | Granularidade de wards | ✅ **(b) Todas** |
| A3 | Level-ups filtrados | ✅ **(b) Todos** |
| A4 | Classificação de engagement | ✅ **Janela 12s + ≥2 kills, classifica por tamanho** — ver tabela abaixo |
| A5 | Key moments | ✅ **Lista expandida** — ver abaixo |
| A6 | Coord conversion | 🔵 **Descobrir durante o ETL** — o César vai inspecionar uma amostra de frames Riot pra confirmar convenção (bottom-left vs top-right) antes de fixar a fórmula |
| A7 | `note` via IA | 🔵 **Ver análise de custo abaixo** — decisão: gerar **on-demand** durante `match-analysis`, nunca em batch (ver Ticket C) |

#### A5 — Lista canônica de key moments (decisão do César)

Lista final que marca `key_moment = true` em `match_timeline_events`:

| # | Key moment | Critério |
|---|------------|----------|
| 1 | **First blood** | Primeiro kill da partida |
| 2 | **Ace** | Wipe completo (5x0) do time inimigo |
| 3 | **Teamfight 5v5** | Engagement (A4) com ≥4 de cada lado |
| 4 | **Baron / Elder / 2º Soul Drake** | ELITE_MONSTER_KILL dos tipos `BARON_NASHOR`, `ELDER_DRAGON`, ou drake que concede alma |
| 5 | **Nexus tower / Nexus** | BUILDING_KILL de `NEXUS_TURRET` ou `NEXUS` |
| 6 | **Pickoff antes de objetivo** — *novo* | Kill ou skirmish ocorrendo **≤45 segundos antes** de spawn de Baron/Drake/Herald que resulta no objetivo sendo capturado pelo time que fez o pickoff |
| 7 | **Gold swing kill** — *novo* | Kill (ou engagement pequeno) que gera **swing de ≥2000g** líquido pro time killer nos 60s seguintes (considera shutdown bounty + assists + torres/plates derivadas da morte) |
| 8 | **Pickoff de grande grupo** — *novo* | Engagement 3+ jogadores com vantagem numérica final ≥2 em favor do killer, fora de contexto de objetivo |

> Critérios 6, 7, 8 adicionados pelo César (2026-04-23). Precisam de lógica stateful no ETL (look-ahead de 45-60s pra determinar se virou key moment) — implementar em 2ª passada depois de gravar eventos crus.

#### A4 — Tabela de classificação (decisão do César)

Janela temporal fixa: **12 segundos**. Mínimo: **≥2 kills**. Usa número de jogadores envolvidos em cada lado (inclui assists).

| Tamanho (killers × vítimas) | Classificação | `type` no shape |
|------------------------------|---------------|-----------------|
| 1 × 1 | Solo kill | `kill` |
| 2-5 × 1 | Ambush (gank) | `ambush` |
| 2-3 × 2-3 | Skirmish | `skirmish` |
| ≥4 × ≥4 | Teamfight | `teamfight` |

> **Impacto no shape `TimelineEvent`**: o campo `type` ganha `'ambush'` e `'skirmish'` (handoff original só tinha `kill` e `teamfight`). Frontend precisa mapear os 2 novos tipos pros dots coloridos do track.

#### A7 — Análise de custo do `note` via IA

Premissa: 50-100 eventos por match, ~500 tokens in + 50 tokens out por evento gerado.

| Estratégia | Tokens/match | Custo Gemini 2.5 Flash | Custo 10k matches/semana | Anual |
|------------|--------------|------------------------|---------------------------|-------|
| Gerar em batch no ETL | ~30k | ~$0.004 | **$40/semana** | **$2.080/ano** |
| Gerar on-demand (só quando user pede match-analysis) | ~30k por análise | ~$0.004 | Escala com demanda — Premium usa ~10x/mês → $0.04/user/mês | **~$50/ano por 100 users** |

**Decisão**: ✅ **On-demand**. Evita pagar por matches que ninguém nunca vai abrir. Integra com o `match-analysis` do Ticket C (o payload já fica no cache de 7d).

### Entregáveis

- Migration SQL da tabela `match_timeline_events`
- Script `scripts/processing/process_timeline_events.py` idempotente
- GitHub Action (se A1 = a)
- Endpoint `GET /api/v1/match/{match_id}/timeline` retornando `{ events: [...], xp_curve: {blue, red}, heatmap: [...] }`

### Estimativa

- Migration + script + testes: 2 dias (César)
- GitHub Action: 0.5 dia
- Endpoint: 0.5 dia (André)

---

## Ticket B — p-0.9.22 backend: Radar v2 (8 eixos canônicos)

**Status atual**: Frontend entrega DualRadar polish (p-0.9.22). Backend hoje envia 8 valores em escala 0..10 com labels `AGR/MAP/EFC/PRS/SBV/UTL/ERL/CST` via endpoint `/api/v1/player/recommendations` — a fórmula é ad-hoc por role.

**O que o HANDOFF pede** (seção 2.3): normalização z-score + logística por elo×role, com fórmulas canônicas:

| Eixo | Fórmula sugerida (handoff) |
|------|-----------------------------|
| MECÂNICA | z-score de `kills + (assists*0.7) - deaths*1.2` ponderado por DPM |
| MACRO | `objectives_participation + tower_participation + game_win_rate_when_winning` |
| FARMING | z-score de CS/min vs média do elo+role |
| VISÃO | `vision_score_per_minute` — clamp maior pra não-suportes |
| TEAMFIGHT | `damage_share_in_teamfights + survival_in_fights` |
| EARLY | Gold diff @ 10 + XP diff @ 10 + CS diff @ 10 |
| AGRESSÃO | `solo_kills + first_blood_participation + roams_successful` |
| DUELING | `1v1_win_rate` em duels limpos |

### O que fazer

1. **Migration**: adicionar tabela `champion_ideal_profiles` com `(champion, elo_tier, role, axis, value, sample_size, computed_at)`. PK composto.
2. **Script batch** `scripts/processing/compute_ideal_profiles.py`:
   - Pega os top 100 OTPs de cada `(champion, role, elo_tier)` por `total_games` e `winrate > 55%`
   - Calcula cada eixo em z-score vs população geral do elo+role → normaliza pra 0..1 via logística
   - Grava em `champion_ideal_profiles`
   - Roda semanal (sábado?)
3. **Modify endpoint** `/api/v1/player/recommendations`:
   - Retornar `player_profile` na escala 0..1 (hoje 0..10) ou manter 0..10 e só mudar labels
   - Incluir `percentile: number` por eixo (tooltip do frontend precisa)
   - Labels traduzíveis no frontend: manter `AGR/MAP/EFC/PRS/SBV/UTL/ERL/CST` OU trocar pra MECÂNICA/MACRO/etc do handoff
4. **Endpoint novo** `GET /api/v1/player/axis-breakdown?puuid&axis&elo_tier`:
   - Retorna valor bruto, percentile, ranking no elo, tendência (últimos 20 jogos)
   - Usado pelo modal "Como melhorar [eixo]" quando tiver IA

### Decisões tomadas (2026-04-23)

| # | Tema | Decisão |
|---|------|---------|
| B1 | Escala do valor enviado | 🔵 **A/B test primeiro** — implementar 0..1 em branch, comparar visualmente vs 0..10. Se 0..1 vencer, refatorar partidas antigas e migrar API |
| B2 | Labels dos eixos | ✅ **(c) Frontend traduz** — backend envia keys estáveis (`AGR`, `MAP`, etc), frontend mapeia via i18n |
| B3 | População pro z-score | ✅ **(c) Patch atual se tiver amostra suficiente, senão (a) todo o elo×role** — regra: mínimo 5.000 partidas no patch pra usar population daquele patch. Abaixo disso usa população histórica do elo×role |
| B4 | `sample_size` mínimo pros OTPs ideais | ✅ **Top 100 com ≥55% WR como alvo**, mas flexível em champs de nicho — se não houver 100 OTPs com WR≥55%, pega o que tem e baixa o threshold até mínimo de 20 OTPs ou WR≥52% (o que for menos permissivo) |
| B5 | Baixo sample → UI | ✅ **Backend envia `confidence: 'high' \| 'low'`**. `low` quando jogador <10 partidas no champ OU perfil ideal <20 OTPs. Frontend (p-0.9.22) já renderiza player dashed nesse caso |

### Estimativa

- Migration + script + testes: 3 dias (César)
- Modify endpoints: 1 dia (André)

---

## Ticket C — p-0.9.23: AI Insights

**Status atual**: Chat Metis funciona (streaming Gemini Flash Lite), token counter, guardrail LoL. Nada mais.

**O que o HANDOFF pede** (seção 3): 3 formatos de insight, 3 endpoints novos.

### Endpoints propostos

```
POST /api/ai/match-analysis
  body: { matchId, puuid }
  response: MatchAnalysis   (shape no HANDOFF 3.1.B)
  cache: 7 dias em (matchId, puuid)
  cost: ~8k tokens

POST /api/ai/inline-insight
  body: { scope: 'match'|'player'|'champion', id }
  response: AIInsight[]
  cache: 24h
  cost: ~1k tokens cada

POST /api/ai/chat (SSE streaming — já parcialmente existe)
  body: { sessionId, message, context?: { type, id } }
  response: SSE stream
```

### Decisões tomadas (2026-04-23)

| # | Tema | Decisão |
|---|------|---------|
| C1 | LLM | ✅ **Gemini 2.5 Flash** — ~10x mais barato que Claude Haiku 4.5 pro uso esperado (ver comparativo abaixo) |
| C2 | Cache storage | ✅ **(c) Cloudflare KV** — já estamos no ecossistema Cloudflare (R2), TTL nativo, edge latency baixa |
| C3 | Rate limit + loja de tokens | ✅ **Expandir rate limit pro match-analysis, baixar cotas grátis+premium+pro, abrir loja avulsa pra Premium+** — ver spec abaixo |
| C4 | Gate Free no match-analysis | ✅ **Blur (mais persuasivo)** — tldr + score + 1 strength + 1 weakness + 1 keyMoment visíveis; resto blur. **Bônus**: free vê 1 recomendação de campeão por role sem análise de texto (ver Ticket D) |
| C5 | Pré-prompting do chat via timeline event | 🔵 **Implementar quando Bloco 0 estiver pronto** — depende do shape dos eventos. Não é blocker |
| C6 | Copywriting + guardrails | ✅ **System prompt forte + few-shot examples** — validação offline periódica (semanal, amostra aleatória) em vez de pós-processar cada resposta. Ver análise de tokens abaixo |

#### C1 — Comparativo de preços (abril 2026)

Por match-analysis típico: ~8k tokens in + ~1k tokens out. Multiplicado por uso mensal médio.

| Modelo | Input ($/1M tok) | Output ($/1M tok) | Custo/análise | 100 users × 10/mês |
|--------|-----------------:|------------------:|--------------:|-------------------:|
| Gemini 2.5 Flash | ~$0.10 | ~$0.40 | **~$0.0012** | **~$1.20/mês** |
| Claude Haiku 4.5 | ~$1.00 | ~$5.00 | ~$0.013 | ~$13/mês |

> Gemini 2.5 Flash vence com folga no custo. Qualidade suficiente pro tom técnico-amigável com system prompt bem calibrado. Se qualidade não entregar, fallback pra Claude Haiku fica como plano B (nesses casos vale o $13/mês).

#### C3 — Cotas novas + loja de tokens avulsos

**Novas cotas (mais baixas que o proposto original)**:

| Tier | Tokens/mês (antes) | Tokens/mês (novo) | Análises de match/mês |
|------|-------------------:|------------------:|----------------------:|
| Free | 2k | **1k** | 0 (só chat curto) |
| Doador | 5k | **3k** | 0 |
| Premium | 150k | **50k** | ~6 match-analysis + chat |
| Pro | 500k | **200k** | ~25 match-analysis + API |

**Loja avulsa** (`/pricing` + card em `/account`):
- Só **Premium+** (Premium e Pro) podem comprar
- Preço = **1.15 × custo-fonte atualizado diariamente** (job diário puxa preço Gemini, aplica markup, salva em `token_packages`)
- Pacotes sugeridos: 10k, 50k, 200k, 1M tokens
- Validade: sem expiração (não expira — tokens extras não resetam com o mês)
- Saldo total = `cota_mensal_tier + saldo_comprado`, consome mensal primeiro

**Tabelas novas**:
```sql
CREATE TABLE token_price_snapshots (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,           -- 'gemini-2.5-flash'
  input_usd_per_1m NUMERIC NOT NULL,
  output_usd_per_1m NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_token_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  extra_tokens_remaining INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tokens_bought INT NOT NULL,
  price_brl NUMERIC NOT NULL,       -- já convertido com markup 1.15×
  snapshot_id BIGINT NOT NULL REFERENCES token_price_snapshots(id),
  status TEXT NOT NULL,             -- 'pending'|'paid'|'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
```

**Novos endpoints**:
- `GET /api/v1/tokens/prices` — pacotes com preço calculado (público)
- `POST /api/v1/tokens/checkout` — inicia compra (precisa Stripe integrado primeiro → ver Ticket E futuro)
- `GET /api/v1/tokens/balance` — saldo do usuário logado

> ⚠️ **Depende de Stripe real**. Hoje os cards de assinatura em `/account` são fake. Loja avulsa também fica em stub até Stripe entrar. Spec fica pronta pra quando for ligar.

#### C6 — Guardrails de tom sem gastar tokens extras

Opção descartada: post-processing (fazer 2ª chamada pra validar tom) — dobraria o custo por resposta.

Decisão: **system prompt forte + few-shot examples + validação offline**. Passos:
1. System prompt canônico em `backend/app/ai/prompts/tone_guardrails.py` com regras duras:
   - Nunca "Excellent!", "Great job!", "Perfeito!"
   - Sempre citar métrica concreta
   - Sempre em PT quando locale=pt, EN quando locale=en
   - Campeões em inglês (Kayn, não Rei Macaco)
   - Proibir jargão não-explicado
2. 3-5 few-shot examples no prompt mostrando tom correto
3. Job semanal: sampleia 50 respostas aleatórias da semana, roda um script (Python + Gemini) que classifica cada uma como "ok" / "violation", exporta relatório. César/André revisam, ajustam prompt se precisar.

Custo extra: ~zero nas chamadas de produção. ~50k tokens/semana no sampling = $0.005/semana.

### Entregáveis

- Tabela `ai_cache (scope, id_hash, response JSONB, computed_at, tokens_used)`
- 3 endpoints com rate limit middleware
- Prompts em `backend/app/ai/prompts/{match_analysis,inline_insight,chat_context}.py`
- Testes: snapshot de respostas pra regressão de prompts

### Estimativa

- Prompts + tuning: 3-5 dias (André)
- Cache + rate limit: 2 dias (César/André)
- Frontend integration (`<AIInsight>` primitive + Match Deep Analysis card + pré-prompting): 3 dias (César/Claude Code)

**Custo financeiro (rough)**: Se 100 premium users rodam 10 análises/mês = 8M tokens = ~$15/mês no Gemini Flash Lite. Chat streaming é separado.

---

## Ticket D — p-0.9.24: Champion profile v2

**Status atual**: `/champions/[champion]` existe (p-0.9.14) com 4 tabs. Dados hoje: WR/pick/ban/KDA globais, tier, builds agregadas, matchups lane, synergies simples.

**O que o HANDOFF pede** (seção 4.7): shape `ChampionProfile` bem mais rico:

- `lore` (curta, traduzida)
- `by_elo: { elo, win_rate, games }[]`
- `power_curve: number[18]` (level 1..18)
- `patch_trend: number[5]` (últimos 5 patches)
- `abilities: { q,w,e,r,passive }` (Data Dragon)
- `base_stats: { hp, mp, armor, mr, ad, as, ms, range }` (Data Dragon)
- `builds[].luxury_options`, `situational`, `boots_options` (hoje só tem core)
- `matchups[].category: 'good'|'even'|'bad'`, `note` (IA)
- `synergies: { jungle, support, comp }`

### Decisões tomadas (2026-04-23)

| # | Tema | Decisão |
|---|------|---------|
| D1 | Lore + abilities + base_stats + runas + itens | ✅ **(b) Sync semanal** — `sync_champion_meta.py` roda toda semana. **Bônus**: botão admin em `/admin` pra forçar refresh quando precisar (novo patch, hotfix) |
| D2 | Power curve | 🔵 **Derivar de eventos** — sinais: participação do champion em kills/objetivos por minuto, gold advantage na lane, winrate por minuto-do-jogo. Precisa spike de análise de dados pra validar sinais antes de codar. **Guardar plano ML complexo pra v2.1** (ver D5) |
| D3 | Matchup categories (good/even/bad) | ✅ **Relativo à WR global do champion**, não absoluto. Fórmula: `delta = player_wr_vs_champ - enemy_champ_global_wr`. `good` se `delta > +3pp`, `even` se `abs(delta) ≤ 3pp`, `bad` se `delta < -3pp`. Exemplo: 51% contra um champ que tem 65% global = **good** |
| D4 | Matchup `note` via IA | ✅ **Só top 5 counters principais por champion+role**, cache **14 dias**. **Premium vê texto completo**, free vê só a categoria (good/even/bad). Premium+ pode **pedir detalhe expandido sob demanda** (consome da cota mensal ou tokens avulsos) |
| D5 | Synergies comp type | ✅ **Começar com heurística simples do excel existente do César**. Plano ML complexo fica em backlog (mesma lógica de "recomendação complexa") |
| D6 | Builds filtradas por matchup | 🔵 **Destravar quando tiver ≥10k partidas salvas de um patch**. Hoje o trigger é volume, não tempo — fica como feature flag em backend |

#### D2 — Spike de dados necessário (César)

Antes de codar o power curve, rodar análise exploratória pra identificar sinais estáveis. Questões:
1. Qual minuto do jogo um champ em média participa de 1º kill? (proxy de early presence)
2. Delta de gold do champ vs média do role por minuto — onde está o pico?
3. Winrate condicionada a "chegar aos 30min": quanto pesa pra cada champ?

**Formato do spike** (decisão César): pasta `analysis/power_curve/` (gitignored) com:
- `run.py` — script Polars que puxa de Supabase/R2, gera gráficos em `results/`
- `results/*.png|csv` — outputs da análise
- `NOTES.md` — conclusões + sinais recomendados pro backend

Quando terminar, os sinais escolhidos viram spec pro `compute_power_curve.py` do backend.

#### D3 — Impacto no frontend

O atual `/champions/[champion]` tab Matchups usa thresholds absolutos vindos do backend. Com a mudança:
- Backend adiciona campo `category_relative: 'good'|'even'|'bad'` no shape do `Matchup` (o `category` absoluto continua, só renomeia pra `category_absolute` pra compat)
- Frontend usa `category_relative` por padrão, toggle pra mostrar absoluto como secundário

#### D4 — Nova tabela + endpoint

```sql
CREATE TABLE champion_matchup_notes (
  id BIGSERIAL PRIMARY KEY,
  champion TEXT NOT NULL,
  role TEXT NOT NULL,
  opponent TEXT NOT NULL,
  note_short TEXT NOT NULL,          -- 1-2 linhas, público
  note_detailed TEXT,                -- 4-8 linhas, premium
  tokens_used INT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,   -- generated_at + 14 days
  UNIQUE (champion, role, opponent)
);
CREATE INDEX ON champion_matchup_notes (expires_at);
```

Endpoint: `GET /api/v1/champion/{id}/matchup/{opponent}?role=X&expand=true` — `expand=true` requer Premium+.

#### D5 — Templates do excel (prontos em `.speckit/templates/`)

Dois CSVs pra César preencher localmente:
- [`.speckit/templates/comp_heuristics_champions.csv`](templates/comp_heuristics_champions.csv) — 19 colunas × ~300 linhas (168 champs × ~2 roles viáveis)
- [`.speckit/templates/comp_heuristics_items.csv`](templates/comp_heuristics_items.csv) — 9 colunas × ~180 linhas (itens finais + starters + boots)
- [`.speckit/templates/README.md`](templates/README.md) — docs de cada coluna e valores aceitos

**Fluxo**: César copia pra `analysis/comp_heuristics/` (gitignored), preenche no Excel/Sheets, me chama de volta e eu escrevo o script de ingestão `scripts/processing/ingest_comp_heuristics.py` que popula as tabelas `champion_archetypes` e `item_archetypes` no Supabase.

**Algoritmo de classificação de comp** (após ingestão): função Python consumida pelo endpoint `/api/v1/champion/{id}/synergies`. Soma tags do time dos 5 picks + primeiro item de cada → classifica comp como `dive`/`poke`/`scaling`/`early`/etc. Thresholds saem do excel do César.

### Entregáveis

- Tabela `champion_meta` (D1)
- Script `sync_champion_meta.py` (semanal)
- Modify `/api/v1/champion/{id}` pra retornar shape novo
- Frontend: reescrever `app/champions/[champion]/page.tsx` (4 tabs novas, hero com splash)

### Estimativa

- Data sync (D1-D2): 3 dias (César)
- Matchup notes via IA (D4): 2 dias (André)
- Frontend rewrite: 3 dias (César/Claude Code)

---

## Resumo executivo (atualizado 2026-04-23)

| Ticket | Nome | Bloqueia | Backend | Frontend | Custo $$ |
|--------|------|----------|---------|----------|----------|
| A | Bloco 0 (timeline ETL) | C (parcial) | 3-5 dias | 3 dias | Baixo (nota IA é on-demand) |
| B | Radar v2 z-score | — | 4 dias | Pronto (p-0.9.22) | Zero |
| C | AI Insights + loja de tokens | — | 7-9 dias (+loja) | 4 dias (+loja em /account) | ~$1.20/mês/100 users (Gemini 2.5 Flash) |
| D | Champion v2 | — | 5-7 dias (+spike D2) | 3 dias | ~$5 setup (só top 5 counters × 168 champs × 5 roles) |

**Caminho crítico**: A (Bloco 0) → (B ∥ C ∥ D) em paralelo. **C depende de Stripe real pra loja** — fica stub.

## Seguimentos (ações pendentes)

| Quem | O quê | Bloqueia |
|------|-------|----------|
| César | Rodar spike do D2 (power curve) — scripts em `analysis/power_curve/` (gitignored) com `run.py` + `results/` + `NOTES.md` | D2 implementação |
| César | Preencher os CSVs de comp heuristics — copiar `.speckit/templates/*.csv` pra `analysis/comp_heuristics/` e preencher | D5 implementação |
| César | Confirmar convenção de coord da Riot timeline (A6) — inspecionar 5 matches conhecidos (quem estava blue, onde morreram) | A implementação do script ETL |
| César/André | A/B test da escala 0..1 vs 0..10 no radar (B1) — branch de teste no staging | B1 migração de API |
| André | Integrar Stripe (Ticket E futuro — não estava neste doc) | C3 loja de tokens + cards reais em `/account` |
| André | System prompt + few-shot examples de tom (C6) — draft em `backend/app/ai/prompts/tone_guardrails.py` | C rollout |
| Claude Code | Implementar os tickets conforme cada um ficar desbloqueado | — |

## Notas arquiteturais novas introduzidas pelas decisões

1. **Novo campo `type` em `TimelineEvent`**: `'ambush'` e `'skirmish'` além de `'kill'` e `'teamfight'` (decisão A4). Frontend da timeline precisa saber.
2. **Campo `confidence: 'high'|'low'`** no shape de recomendações (decisão B5) — frontend já aceita via DualRadar.
3. **Campo `category_relative` em Matchup** além do `category_absolute` (decisão D3) — breaking change no shape.
4. **3 tabelas novas do sistema de tokens** (decisão C3): `token_price_snapshots`, `user_token_balances`, `token_purchases`. Depende de Stripe.
5. **Job diário novo**: puxa preço da fonte Gemini, salva snapshot, recalcula preços dos pacotes (C3).
6. **Job semanal novo**: sampling de 50 respostas de IA pra relatório de tom (C6).
7. **Endpoint admin refresh** em `/admin` pra forçar `sync_champion_meta` (decisão D1).

## Arquivos de referência

- [`.speckit/handoffs/metis-1-0/HANDOFF-TECNICO.md`](handoffs/metis-1-0/HANDOFF-TECNICO.md) — spec completo do Claude Design
- [`.speckit/handoffs/metis-1-0/metis/`](handoffs/metis-1-0/metis/) — mocks JSX de todas as telas
- [`CLAUDE.md`](../CLAUDE.md) raiz — regras de ouro
- [`backend/CLAUDE.md`](../backend/CLAUDE.md) — stack backend
