# Metis - Patch Notes

*Diário de mudanças significativas no ecossistema e na stack do projeto.*

## v0.8.0 — Mega Update: Header, Tier List, Player Page, Match Detail, Itens, IA, Pricing (2026-04-14)

### Frontend — Infraestrutura
- **Header compartilhado** (`Header.tsx`): extraido de 9 paginas, logo Metis clicavel em todas as telas, removido botao "Inicio"
- **Barra superior** maior (py-4, text-sm, icones w-4), botoes maiores
- **Light mode** melhorado: text-dim mais escuro, bordas mais visiveis
- **Cor S+ gold** (amber-400) nos tier badges

### Frontend — Tier List
- **Tier badges** (S+/S/A/B/C/D) calculados por percentil dinamico no backend
- **Tabela simplificada**: #, Campeao, Tier, Winrate, Partidas, KDA, DPM
- **Dropdown de patch** (busca patches reais do banco via `GET /api/v1/stats/patches`)
- **Range de patch** com dois selects (patch inicial + patch final)
- **Emblemas de elo** maiores com scale por elo (zoom 4.5x, overflow hidden)
- **Labels claros**: "Todas as Roles", "Todas as Regioes"

### Frontend — Pagina de Campeao
- **Dropdown de patch** substituiu input livre
- **Winrate normalizado** nos matchups (coluna "vs Media")

### Frontend — Player Page
- **Busca inteligente**: input unico `Nick#Tag` na home
- **Autocomplete** com debounce 300ms, icone do jogador, servidor, nome antigo
- **Seletor de servidor** na busca
- **Layout expandido** (max-w-7xl), grid 2 colunas (sidebar 380px + historico)
- **2 resumos lado a lado**: ultimas 20 partidas + temporada completa
- **Campeoes jogados** com filtros: temporada (S1/S2/S3-2026), patch, role
- **Melhor campeao** da temporada destacado acima da tabela
- **Jogou recentemente com**: aliados com >=2 jogos, W/D, icone circular, "ver todos"
- **Nemesis**: oponentes >=2x, campeoes usados, "ver todos"
- **Recomendacoes de campeao por lane** via similaridade de cosseno (Diana JG != Diana Mid)
- **Nomes antigos**: historico de nicks detectado no sync, redirect por nome antigo
- **Badge de elo** ao lado do nick, PUUID escondido
- **Supervisao**: icone do jogador + nome (sem PUUID) na home

### Frontend — Match Page
- **Layout 85%** da tela
- **Ordenacao por role** (TOP > JG > MID > ADC > SUP) sempre
- **Metis Score** por role (pesos variam: ADC pesa mais dano, SUP pesa mais visao)
- **Cores de elo** no Metis Score: gradient 2 tons (Iron stone+cinza, GM vermelho+metalico, Challenger ciano+dourado)
- **3 tabs**: Scoreboard, Analise de Equipe, Build
- **Tab Analise de Equipe**: donut charts SVG (kills, gold, dano, visao, CS) + barras por jogador
- **Tab Build**: items com ordem (1o-6o + trinket), summoner spells com nome PT-BR, runas completas (primaria + secundaria com cores de arvore)

### Frontend — Itens
- **Nova pagina `/items`** com tabela de itens: icone, nome, picks, winrate
- **Filtros**: busca por nome, role, patch, ordenacao por popularidade ou winrate
- **Link "Itens"** no header

### Frontend — Pricing
- **Nova pagina `/pricing`** com 4 tiers: Free (Silver), Doador (Emerald), Premium (Master), Pro (Challenger)
- **Emblemas de elo** no topo de cada card
- **Toggle mensal/anual** (20% off)
- **Tabela comparativa** de beneficios
- **FAQ** com 5 perguntas
- **Link "Planos"** no header

### Backend — Novos Endpoints
- `GET /api/v1/stats/patches` — patches disponiveis no banco
- `GET /api/v1/stats/tierlist` — agora aceita `patches` (comma-separated) e retorna `tier`
- `GET /api/v1/player/search` — busca por nome atual e antigo, com "formerly"
- `GET /api/v1/player/name-history` — historico de nomes
- `GET /api/v1/player/seasons` — temporadas disponiveis
- `GET /api/v1/player/champion-stats` — filtros: role, patch, season
- `GET /api/v1/player/frequent-allies` — aliados com >=N jogos juntos
- `GET /api/v1/player/nemesis` — oponentes enfrentados >=N vezes
- `GET /api/v1/player/recommendations` — recomendacoes por lane com reasons
- `GET /api/v1/items/ranking` — ranking global de itens com winrate
- `POST /api/v1/chat` — agora usa LLM real (Gemini Flash Lite ou Ollama)

### Backend — Servicos Novos
- `llm_adapter.py` — adapter multi-LLM: GeminiAdapter + OllamaAdapter + system prompt Metis
- `player_service.py` — champion-stats, frequent-allies, nemesis
- `recommendation_service.py` — recomendacoes por lane via similaridade de cosseno 6D
- `item_service.py` — ranking de itens agregado de match_participants

### Banco de Dados (Supabase)
- **`player_name_history`** — historico de nomes (puuid, old_game_name, old_tag_line, changed_at)
- **`user_riot_accounts`** — vinculo conta Riot <-> usuario Metis
- **`subscriptions`** — plano (free/donor/premium/pro), status, pagamento, vencimento
- **`payment_history`** — historico de pagamentos
- **`user_badges`** — badges publicas no perfil
- **Deteccao automatica** de mudanca de nome no sync

### Dependencias
- `google-generativeai` instalado para Gemini Flash Lite

---

## v0.7.2 — process_timelines com eventos completos + fix Mobafire CI (2026-04-03)

### Scripts — process_timelines.py
- `extrair_dados_timeline()` agora extrai dados completos por tipo de evento:
  - **CHAMPION_KILL:** `secondary_participant_id` (PUUID da vítima via `victimId`) + `assisting_participant_ids` (array de PUUIDs dos assistentes)
  - **ELITE_MONSTER_KILL:** `details` JSONB com `monsterType` e `monsterSubType`
  - **BUILDING_KILL:** `details` JSONB com `buildingType`, `laneType`, `towerType` e `teamId`
- Migration: colunas `secondary_participant_id TEXT`, `assisting_participant_ids TEXT[]`, `details JSONB` adicionadas à tabela `critical_events` (nullable — compatível com timelines já processadas)

### Scripts — fetch_guides.py + fetch_guides.yml (Mobafire)
- **BUG-015 resolvido:** `fetch_guides.yml` referenciava `secrets.CLOUDFLARE_R2_ACCOUNT_ID` (inexistente) — o correto é `secrets.R2_ACCOUNT_ID`, alinhado com todos os outros workflows do projeto. R2 client nunca conectava em CI.
- `CLOUDFLARE_R2_BUCKET_NAME` hardcoded como `"metis"` (igual ao `process_matches.yml`) — remove dependência de secret desnecessário.
- **BUG-016 resolvido:** `chromium.launch()` sem `--no-sandbox` crashava silenciosamente no container Ubuntu do GitHub Actions. Adicionado `args=["--no-sandbox", "--disable-dev-shm-usage"]` quando `headless=True`. Adicionados `viewport` e `locale` ao contexto para reduzir detecção de headless pelo Mobafire.

---

## v0.7.1 — Bugfixes: ordenação do histórico + data real de partida (2026-04-03)

### Backend
- **BUG-013 resolvido:** `GET /api/v1/player/history` ordenava por `matches.created_at` (timestamp de inserção no Supabase) — partidas mais antigas synced primeiro ficavam no topo. Corrigido para ordenar por `match_participants.match_id desc` (coluna direta, sem foreign_table — PostgREST não respeitava o order no join).
- **BUG-014 resolvido:** `'NoneType' object has no attribute 'data'` no sync — `execute()` do Supabase retornava `None` em `_match_exists()` e no check de cooldown. Adicionados null guards (`if clean and clean.data`).
- **Migration:** `game_end_timestamp BIGINT` adicionado à tabela `matches` para armazenar o timestamp real do fim da partida (epoch ms da Riot API).
- `riot_service.py` popula `game_end_timestamp` com `info.gameEndTimestamp` em `_processar_e_salvar`.

### Frontend
- **`MatchCard`** usa `game_end_timestamp` no lugar de `created_at` para o label de data relativa ("há 2h", "há 3 dias"). Partidas antigas sem o campo mostram `—`.

---

## v0.7.0 — Endpoints de Campeão + Página de Campeão + Fix de ícones (2026-04-03)

### Backend
- **`GET /api/v1/champion/{champion}/overview`** — stats médias do campeão (winrate, KDA, DPM, CS/m, KP, gold) com filtros role/server/patch/min_matches; retorna `stats=null` sem 404 quando há dados insuficientes
- **`GET /api/v1/champion/{champion}/builds`** — itens mais frequentes via view `champion_item_stats`, ordenados por pick_count; filtros patch/min_picks
- **`GET /api/v1/champion/{champion}/matchups`** — winrate do campeão contra cada oponente na mesma lane (2 queries + agregação Python); filtros role/patch/min_matches
- **`GET /api/v1/champion/{champion}/synergies`** — winrate com aliados na mesma partida; mesma estratégia do matchups; exclui auto-sinergia
- Arquivos novos: `backend/api/routes/champion.py` + `backend/services/champion_service.py`
- Router registrado em `backend/main.py`
- Testes: `tests/test_champion_api.py` — 18 testes cobrindo os 4 endpoints

### Frontend
- **`/champions/[champion]`** — página de campeão com tabs Overview / Builds / Matchups / Sinergias; filtros globais role/server/patch; ícone via DDragon CDN; fetch paralelo dos 4 endpoints
- **`StatsTable`** — nome do campeão na Tier List agora é link clicável para `/champions/{champion}`
- **`MatchCard`** — botão "Campeão" (BarChart2) adicionado nos botões laterais → `/champions/{champion_name}`

### Bugfix
- Ícones de role e elo (Tier List) estavam sendo servidos como arquivos stub de 111–162 bytes; substituídos por assets reais baixados do CommunityDragon CDN

---

## v0.6.7 — Bugfix: API travando + maybe_single() + ícone Zaras (2026-04-03)

### Backend — riot_service.py
- **BUG-009 resolvido:** rotas `/sync` e `/update-history` trocadas de `async def` para `def` — FastAPI passa para thread pool, event loop não trava durante sync (era 60s+ bloqueado)
- **BUG-010 resolvido:** cooldown check em `atualizar_historico` trocou `.maybe_single()` por `.limit(1).order(last_synced_at)` — evita 406 quando há múltiplos registros com o mesmo Riot ID
- **BUG-011 resolvido:** `_match_exists()` trocou `.maybe_single()` por `.limit(1)` nas tabelas `matches` e `matches_dirty` — evita NoneType crash em caso de 406

### Banco — Zaras#0210
- **Ícone populado:** `profile_icon_id = 7` (era null), agora `/players/Zaras%230210` exibe o avatar corretamente
- **Diagnóstico de PUUID duplicado** (BUG-012): dois registros — `BgAPcGAE...` (legítimo, BR1) e `dtGYQZ8cj4D...` (fantasma, sem server). Pendente aval para limpeza.

### Diagnóstico do sistema (checagem completa)
- Backend: ✅ UP · Tierlist: ✅ 58 campeões · Admin endpoint: ✅ estruturalmente OK
- Banco: 308 players, 37 matches, 370 participants, 2 dirty, 0 timelines (histórico pré-feature)
- Últimas 15 partidas do Zaras são Arena (queue 1700) — filtradas corretamente por `wrong_queue`

---

## v0.6.6 — Rate Limit de Sync + Painel Admin (2026-04-03)

### Backend
- **`SyncCooldownError`** em `riot_service.py` — cooldown de 5 min por jogador (verificado por `game_name + tag_line` antes de chamar a Riot API); `last_synced_at` gravado no upsert de `players`
- **`GET /api/v1/admin/stats`** — novo endpoint protegido; valida JWT via `supabase.auth.get_user(token)`, exige `app_metadata.is_admin = true`; retorna: `players_total`, `matches_clean`, `matches_dirty_total`, `matches_dirty_by_reason`, `participants_total`, `timelines_saved`, `synced_last_24h`, `synced_last_7d`
- `player.py` — captura `SyncCooldownError` nos endpoints `/sync` e `/update-history`, retorna HTTP 429 com `{ retry_after_seconds }`

### Banco de dados
- **Coluna `last_synced_at TIMESTAMPTZ`** adicionada em `players` (migration `add_last_synced_at_to_players`)
- **Usuário admin** criado: `admin@metis.gg` / `nimda`, `app_metadata.is_admin = true`

### Frontend
- **`/admin`** — dashboard protegido (requer sessão via middleware + `is_admin` no componente): 8 cards de stats, breakdown de dirty matches com barras de proporção, botão de logout
- **`/auth`** — campo email aceita `"admin"` e mapeia silenciosamente para `admin@metis.gg`
- **`/players/[puuid]`** — botão "Ver partidas novas" exibe countdown reativo (`2m 47s`), desabilitado durante cooldown; cooldown persiste em `localStorage` entre reloads; ativado tanto após sync bem-sucedido quanto em resposta a 429 do backend
- **`middleware.ts`** — `/admin` adicionado às rotas que exigem sessão

---

## v0.6.5 — Timeline da Partida (CS/m, Gold, XP) (2026-04-03)

### Backend — match.py
- **`GET /api/v1/match/{match_id}/timeline`** — novo endpoint com lazy-cache:
  - Cache hit: retorna `match_timelines.frames` sem chamar a Riot API
  - Cache miss: busca `server` do jogador via `match_participants → players`, chama Riot API (`match.by_id` para ordem dos PUUIDs + `match.timeline_by_match`), parseia, salva e retorna
  - Respostas: 404 (partida inexistente), 422 (sem server), 500 (sem `RIOT_API_KEY`), 502 (erro Riot API)
- Helper `_parse_timeline_frames(frames_raw, puuids_ordered)` — parsing puro extraído para reutilização
- Helper `_get_routing_region(server)` — copiado de `riot_service.py` para evitar acoplamento circular

### Frontend — TimelineChart.tsx [NEW]
- Componente SVG puro (`viewBox 600x190`, responsivo com `width="100%"`)
- Tabs: **CS/m | Ouro | XP** com troca reativa
- Uma linha por participante; time azul = tons de azul, time vermelho = tons de vermelho
- Jogador destacado (via `highlightedPuuid`) recebe linha mais grossa e opacidade total
- Grid horizontal com labels formatados (gold: `12.3k`, xp: `8k`, cspm: `7.5`)
- Labels do eixo X em minutos (step adaptativo: 3 / 5 / 10 min)
- Legenda com cor e nome de cada jogador; jogador destacado em negrito

### Frontend — `/matches/[match_id]/page.tsx`
- Seção colapsável "Timeline da Partida" abaixo do scoreboard (visível apenas quando `has_timeline = true`)
- Fetch lazy: só busca `/timeline` ao abrir pela primeira vez; re-aberturas usam cache de estado
- Estados: carregando, erro, e chart renderizado

### Testes
- `tests/test_match_api.py` — 10 novos testes em `TestMatchTimeline` (30 total no arquivo):
  cache hit / cache miss / salva no banco / frames parseados / 404 / 422 / 500 / 502

### Totais acumulados
- **247 testes passando** (10 novos nesta versão)

---

## v0.6.4 — Histórico Rico: Items, Runas, CS/m + Resumo do Jogador (2026-04-03)

### Banco de dados
- **`match_participants`** — 12 novas colunas: `team_id`, `items` (JSONB), `summoner1_id`, `summoner2_id`, `rune_keystone`, `rune_primary`, `rune_secondary`, `runes_raw` (JSONB), `total_cs`, `cs_per_minute`, `champion_level`, `items_purchased`
- **Nova tabela `match_timelines`** — JSONB com snapshots por minuto por PUUID (`cs`, `cspm`, `gold`, `level`, `xp`); RLS pública; PK em `match_id`

### Backend — riot_service.py
- `_processar_e_salvar()` extrai e salva items, runas (keystone + árvores + raw), CS/m, team_id e summoner spells de cada participante
- Nova função `_salvar_timeline()` — busca `lol_watcher.match.timeline_by_match()`, converte `participantId → PUUID` via `metadata.participants`, filtra frames por minuto, salva em `match_timelines`; falha silenciosa (não bloqueia sync)
- `atualizar_historico()` chama `_salvar_timeline()` imediatamente após cada partida nova salva

### Backend — player.py
- `GET /api/v1/player/history` select expandido: `team_id`, `vision_score`, `kill_participation`, `damage_per_minute`, `total_cs`, `cs_per_minute`, `champion_level`, `items`, `rune_keystone`, `summoner1_id`, `summoner2_id`

### Frontend — MatchCard reescrito
- Items (7 slots com slots vazios), keystone (DDragon perk-images), nível final sobrepostos no ícone
- CS/m colorido por performance (verde/amarelo/cinza/vermelho)
- Data relativa ("há 2 dias"), patch ("Patch 16.7"), duração e end_type em rodapé do card
- Queue label ("SoloQ" / "Flex"), badge vitória/derrota
- Botões "Detalhes" (→ `/matches/[id]`) e "Analisar" (→ `/chat`)

### Frontend — Player Page
- Bloco de resumo (`useMemo`) acima do histórico: winrate colorido, KDA médio, CS/m médio, campeão mais jogado com ícone e WR
- `useMemo` atualiza automaticamente ao "Carregar mais"

### Novos arquivos
- `frontend/src/lib/runes.ts` — mapa `keystoneId → DDragon perk-image path`

### Arquivos alterados
- `backend/services/riot_service.py` — `_processar_e_salvar()`, `_salvar_timeline()`, `atualizar_historico()`
- `backend/api/routes/player.py` — select expandido
- `frontend/src/components/matches/MatchCard.tsx` — reescrito
- `frontend/src/app/players/[puuid]/page.tsx` — imports + `useMemo` + bloco de resumo
- Supabase migration: `add_items_runes_cs_timeline`

---

## v0.6.3 — Separação de Dados Sujos + Paginação de Histórico (2026-04-03)

### Arquitetura de dados — matches_dirty
- **Nova tabela `matches_dirty`** no Supabase: registra partidas descartadas pela Camada Prata com campo `reason` (remake, short_game, wrong_queue:N, invalid_json) + snapshot parcial do JSON para debug
- **`riot_service.py`** — filtro duplo: (1) somente queue_id 420 (SoloQ) e 440 (Flex) são aceitas na tabela `matches`; (2) duração < 300s = remake, < 900s = short_game — ambas vão para `matches_dirty`
- **Filosofia:** pipeline coleta tudo, Camada Prata decide. Dados descartados não somem — ficam rastreáveis em `matches_dirty` sem poluir a análise

### Backend — paginação
- `GET /api/v1/player/history` ganha parâmetro `offset` (default 0) + retorna `has_more: bool`
- `limit` default sobe de 10 → 15 para carga inicial
- Resposta inclui `offset` e `limit` para o cliente calcular próxima página

### Frontend — player page
- Carga inicial: 15 partidas
- Botão "Carregar mais" (10 por clique) — visível só quando `has_more: true`; loading state inline
- Badge "Somente SoloQ / Flex" no header da seção de histórico
- Mensagem de empty state atualizada para explicar a filtragem

### Arquivos alterados
- `backend/services/riot_service.py` — `RANKED_QUEUE_IDS`, `_salvar_dirty()`, filtros em `_processar_e_salvar()`
- `backend/api/routes/player.py` — offset + has_more + limit 15
- `frontend/src/app/players/[puuid]/page.tsx` — paginação + badge SoloQ/Flex
- Supabase migration: `create_matches_dirty`

## v0.6.2 — Temas, Home Preenchida e Navegação Livre (2026-04-03)

### Produto
- **Changelog público** — `/changelog` atualizado com entrada v0.6.2 (temas, destaques do meta, navegação)
- **Home page** — seção "Destaques do Meta" com top 6 campeões do tierlist (ícone, nome, winrate colorido), falha silenciosa se backend offline
- **Navegação** — Tier List visível para todos (sem login); header de todas as páginas tem links para Início, O que é novo, Equipe; badge "Alpha v0.6.2" no header

### Temas de cor
- **4 temas:** Azul (padrão), Roxo, Verde, Vermelho
- **ThemeProvider** — context + localStorage + `data-theme` no `<html>` com `suppressHydrationWarning`
- **ThemeSwitcher** — 4 dots coloridos no header com ring de seleção, visível em todas as páginas
- **Implementação CSS:** tokens migrados de hex fixo para `rgb(var(--metis-*) / <alpha-value>)` — suporta modificadores de opacidade do Tailwind (ex: `bg-metis-accent/20`)

### Arquivos alterados
- `globals.css` — 4 blocos `[data-theme]` com variáveis RGB
- `tailwind.config.ts` — todos os tokens agora usam `rgb(var(...))`
- `src/components/ui/ThemeProvider.tsx` — [NEW]
- `src/components/ui/ThemeSwitcher.tsx` — [NEW]
- `src/app/layout.tsx` — ThemeProvider + suppressHydrationWarning
- `src/app/page.tsx` — top campeões + ThemeSwitcher + nav universal
- `src/app/champions/page.tsx` — ThemeSwitcher + nav universal no header

## v0.6.0 — Frontend Completo + Correções de Infra (2026-04-03)

### Frontend — Novas telas implementadas
- **`/players/[puuid]`** — histórico de partidas com `GET /api/v1/player/history`; componente `MatchCard` (azul=vitória, vermelho=derrota, KDA, ouro, DPM, duração, botão "Analisar")
- **`/champions`** — Tier List global com filtros por role (botões), servidor (select), patch (input) e elo (emblemas Data Dragon, filtro UI-only); tabela `StatsTable` sortável por qualquer coluna
- **`/auth`** — tela de cadastro adicionada (toggle Login ↔ Criar conta), validação client-side, tela "Verifique seu email" pós-signup; callback de email confirmation em `auth/callback/route.ts`
- **`next.config.ts`** — `remotePatterns` adicionado para `ddragon.leagueoflegends.com` (imagens de campeões e emblemas de elo)
- **Deploy Vercel** — configurado Root Directory `frontend`, Framework Next.js, env vars setadas; `package.json` e `package-lock.json` force-added ao git

### Backend — Novos endpoints
- **`GET /api/v1/stats/tierlist`** — retorna todos os campeões com stats agregadas (winrate, KDA, ouro, DPM), filtros: role, server, patch, min_matches
- **`GET /api/v1/player/history`** — histórico de partidas de um PUUID com nested select PostgREST (match_participants → matches)
- **`buscar_tierlist()`** em `stats_service.py` — agregação Python via `defaultdict`, sem nova query por campeão

### Bugfixes de infra
- **BUG-007** — `riot_service.py` importava `_normalizar_patch` de `scripts.processing.process_matches`; crashava o Railway (ModuleNotFoundError). Função inlinalizada, import removido.
- **BUG-008** — `requirements.txt` com encoding UTF-16 LE corrompido. Regenerado com `pip freeze` em UTF-8 limpo.

### Tooling
- **`setup.ps1`** — script PowerShell de bootstrap: cria/valida `.venv`, instala `requirements.txt`, roda `npm install` no frontend. Flags: `-Freeze` (atualiza requirements), `-Backend` (sobe uvicorn após setup).

### Produto — Changelog público e Equipe
- **`/changelog`** — página pública de patch notes em linguagem de produto (sem jargão técnico), timeline visual com badges por tipo (novo/melhoria/fix)
- **`/team`** — página da equipe: César (dourado), Enzo (vermelho), André (verde) — com cargo, empresa, roles no Metis, frase e links
- **Header da home** — botões "O que é novo" (Sparkles) e "Equipe" (Users) sempre visíveis, antes do separador de auth
- **Convenção**: a partir de agora, toda feature de produto entra em `/changelog` junto com o `.speckit/patch_notes.md`

### CI/CD — GitHub Actions
- `fetch_high_elo_matches.yml` — cron meia-noite BRT, timeout 280min, MAX_PLAYERS 400, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`
- `fetch_pros_matches.yml` — cron 19h BRT a cada 2 dias, blocklist sem `academy`
- `process_matches.yml` — cron 11h BRT, paginação 1000-row corrigida em `_get_processed_ids()`
- `process_timelines.yml` — novo Action, cron 12h BRT, loop completo com `_get_processed_timeline_ids()`

## v0.5.0 - Modelo de Acesso e Produto Final (2026-04-03)

### Produto: acesso público + premium + supervisão
- **Modelo de acesso reestruturado:** `/` e `/players/[puuid]` são públicos; `/chat` exige login + `app_metadata.is_premium`
- **`middleware.ts`** — simplificado: só bloqueia `/chat` sem sessão; `/auth` com sessão redireciona para `/` (não `/chat`)
- **`src/app/page.tsx`** — home pública: busca de jogador por PUUID/Riot ID + lista de supervisão para usuários logados
- **`src/app/chat/page.tsx`** — gate de premium antes do chat (tela `Lock` com mensagem clara para não-premium)
- **`src/app/players/[puuid]/page.tsx`** — stats públicas placeholder + toggle de supervisão (Star/StarOff) com label livre
- **Supabase migration `create_watched_players`** — tabela `watched_players` com UNIQUE(user_id, puuid) + RLS "own rows"
- `npx tsc --noEmit` — zero erros

### Regras de acesso
| Rota | Anon | Login | Premium |
|------|------|-------|---------|
| `/` | ✅ | ✅ | ✅ |
| `/players/[puuid]` | ✅ | ✅ | ✅ |
| `/chat` | ❌→/auth | gate | ✅ |

### Concessão de premium
- Via Supabase service role: `auth.admin.updateUserById(userId, { app_metadata: { is_premium: true } })`
- Concedido manualmente pelo time enquanto não existe fluxo de compra

## v0.4.0 - Base do Frontend Next.js 15 (2026-04-03)

### Novo: Frontend scaffoldado do zero
- Next.js **15** + React 19 + TypeScript strict + Tailwind CSS v3
- `@supabase/ssr` com `createBrowserClient` (client) e `createServerClient` (server/middleware)
- `middleware.ts` — refresh de sessão Supabase + redirect automático auth↔chat
- `src/app/auth/page.tsx` — Login Email/Senha via `supabase.auth.signInWithPassword`
- `src/app/chat/page.tsx` — histórico de mensagens (useState), loading dots, fetch para FastAPI
- `src/components/ui/ChatInput.tsx` — textarea + Send (Enter atalho)
- `src/components/ui/ChatMessage.tsx` — bolha user vs metis com avatares lucide
- `frontend/.env.example` e `frontend/CLAUDE.md` criados
- `npx tsc --noEmit` — zero erros, zero vulnerabilidades npm

### Ajustes de documentação
- `README.md` — seção de setup de deps (pip + npm) adicionada, Pinecone removido da stack
- `requirements.txt` — são dumps de `pip freeze` com resíduos de Pinecone/LangChain; **não editar manualmente** — regenerar com `pip freeze > requirements.txt` após limpar o venv quando necessário

## v0.3.0 - Revisão Coluna [Revisão] + Stats API + Builds de Itens (2026-04-03)

### Revisão de Cards (César + Claude)
- **pgvector + Tabela Ouro:** verificado via Supabase MCP — aprovado.
- **Endpoint Sincronizar Partidas (`/sync` + `/update-history`):** 3 bugs corrigidos no `riot_service.py`:
  - `game_version` agora usa `_normalizar_patch()` (consistência com pipeline Bronze→Prata)
  - `team_position` defaulta para `"UNKNOWN"` quando vazio/None
  - `match_participants` upsert com `on_conflict="match_id,puuid"` (sem duplicatas no re-sync)
- **Endpoint Stats/Champions:** não existia no codebase — criado do zero.
- **Testes Funcionais API Metis (M5):** 28/28 passando em `tests/test_funcionais_api_metis.py`.

### Novo: GET /api/v1/stats/champions
- `backend/services/stats_service.py` — agregação Python sobre nested select PostgREST
- `backend/api/routes/stats.py` — Query Params: `champion` (required), `role`, `server`, `patch`, `elo`, `min_matches`
- Filtro `?elo=` aceito mas sem efeito (sem dados de rank por partida no schema)
- `tests/test_stats_api.py` — 17 testes

### Novo: Modelagem e Ingestão de Itens (champion_builds)
- Supabase migration `create_champion_builds` — tabela + UNIQUE + view `champion_item_stats` (winrate_pct automático)
- Supabase migration `fn_upsert_champion_builds` — RPC com `ON CONFLICT DO UPDATE SET pick_count += 1, win_count += won`
- `process_matches.py` — `_get_item_dict()` com lazy cache + `extrair_builds_partida()` (função pura) + chamada RPC em `processar_partida()`
- `database/metis_v1.3.dbml` — tabela `champion_builds` adicionada ao schema
- `tests/test_process_builds.py` — 16 testes

### Totais da sessão
- **140/140 testes passando**
- Novos arquivos: `stats_service.py`, `routes/stats.py`, `test_stats_api.py`, `test_process_builds.py`, `test_funcionais_api_metis.py`
- Migrações Supabase aplicadas: `create_champion_builds`, `fn_upsert_champion_builds`

## v0.2.0 - Revisão das mudanças do André + Correção de Testabilidade (2026-04-02)
- Revisão e aprovação das mudanças do André (CORS, health check, ChatRequest, bugs.md)
- Escrita de 15 testes funcionais cobrindo todas as mudanças (`tests/test_api_andre_changes.py`)
- BUG-001 resolvido: `process_timelines.py` refatorado com injeção de dependência (`db_client`), função `extrair_dados_timeline()` extraída (parsing puro) e lazy init do Supabase
- BUG-002 resolvido: pasta `scripts/Processing` renomeada para `processing` (case fix Windows)
- Adicionados `__init__.py` em todos os pacotes de `scripts/`
- Configurado `[tool.pytest.ini_options]` no `pyproject.toml` (pythonpath + testpaths)
- Total: 17/17 testes passando

## v0.1.0 - Saneamento e Pivot Estrutural
- Pivot oficializado: Abandono do Pinecone em favor do `Supabase (PostgreSQL + pgvector)`
- Introdução do orquestrador `OpenRAG`.
- Implementação inicial da pasta `.speckit` para centralização de estado do AI Context Director.
- Remoção de trackers de tarefas genéricos em favor de Milestones atômicos (`plano_atual.md`).
