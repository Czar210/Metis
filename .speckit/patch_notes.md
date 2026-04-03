# Metis - Patch Notes

*Diário de mudanças significativas no ecossistema e na stack do projeto.*

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
