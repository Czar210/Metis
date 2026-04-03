# Metis - Plano Atual (Milestones Tracker)

*Sincronizado com Trello Oficial — última sync: 2026-04-03*
*Colunas do Trello: [PUC Zaras] | [André] | [Takis] | [Depende de Outras Tarefas] | [Pegue Suas Tarefas] | [Revisão]*

---

## 🧑‍💻 Equipe e Perfis de Atuação

| Membro | Papel | Foco |
|--------|-------|------|
| **César (PUC Zaras)** | Tech Lead, Data Architect, CI/CD | Python/Polars, GitHub Actions, Supabase SQL, R2 |
| **André** | Backend & AI Engineer | FastAPI, Prompt Engineering, Llama 3, OpenRAG |
| **Takida (Takis)** | Frontend & UX | Next.js App Router, Tailwind, Supabase Auth |
| **César + Claude** | Revisão & Validação | Code review, testes, qualidade |

---

## ✅ [Revisão] Milestone 1 — Concluído

Cards na coluna [Revisão] com todas as checklists completas:

### [Revisão ✅] Configuração do pgvector e Tabela Ouro no Supabase
- [x] Habilitar extensão `CREATE EXTENSION IF NOT EXISTS vector;`
- [x] Criar tabela `guides_gold` com colunas: id, champion, title, author, content, embedding (vector)
- [x] Criar índice HNSW na coluna embedding (`vector_cosine_ops`)
- [x] Criar função RPC `match_documents` com operador `<=>` do pgvector

### [Revisão ✅] Criar Endpoints Base do FastAPI
- [x] Inicializar FastAPI em `backend/main.py`
- [x] Configurar CORSMiddleware (origens do Next.js)
- [x] Rota `GET /api/v1/health` → `{"status": "online", "system": "Metis"}`
- [x] Modelo Pydantic `ChatRequest` (campo `mensagem: str`)
- [x] Esqueleto da rota `POST /api/v1/chat`
- [x] Deploy contínuo no Railway apontando para `backend/`

### [Done ✅] Endpoint FastAPI - Sincronizar Partidas do Jogador
- [x] Rota `POST /api/v1/player/sync` recebendo Riot ID (ex: `Zaras#0210`)
- [x] RiotWatcher para descobrir PUUID
- [x] Buscar IDs das últimas partidas via `match.matchlist_by_puuid`
- [x] Download dos dados detalhados por Match ID
- [x] Filtrar remakes e partidas < 15 min
- [x] UPSERT na tabela `matches` do Supabase
- [x] **Bugfix (revisão):** `game_version` normalizada via `_normalizar_patch`, `team_position` defaulta para UNKNOWN, `match_participants` upsert com `on_conflict="match_id,puuid"`

### [Done ✅] Endpoint FastAPI - Estatísticas Médias de Campeões
- [x] Rota `GET /api/v1/stats/champions`
- [x] Agregação Python sobre match_participants com nested select (matches + players)
- [x] Filtros via Query Params (`?role=`, `?server=`, `?patch=`, `?elo=`, `?min_matches=`)
- [x] Retorno JSON estruturado com winrate, KDA, gold, DPM
- [x] `?elo=` aceito mas documentado como sem efeito (sem rank por partida no schema)
- [x] Arquivos: `backend/services/stats_service.py` + `backend/api/routes/stats.py`

---

## 🔄 Tickets Ativos

### [Done ✅] Script de Limpeza de Partidas (Bronze → Prata)
**Arquivo:** `scripts/processing/process_matches.py`
- [x] Criar a lógica de limpeza (filtros: duração, queue, participantes, bots, teamPosition, game_version)
- [x] Montar o loop R2 (`rodar_pipeline`: lista, filtra processed_matches, baixa, processa, marca)
- [x] GitHub Action `.github/workflows/process_matches.yml` (cron 10:00 UTC, BATCH_SIZE=50)
- [x] Bugfix: `on_conflict="match_id,puuid"` no upsert de match_participants

### [PUC Zaras] Automatizar a Raspagem do Mobafire + Bugfix
**Descrição:** Playwright rodando via GitHub Actions 1x/semana, salvando HTML bruto no R2 (Camada Bronze).
- [ ] Corrigir bug existente no script Playwright
- [ ] Configurar GitHub Action com schedule semanal
- [ ] Validar upload no R2

### [Revisão ✅] Modelagem e Ingestão de Itens (Builds dos Campeões)
**Arquivos:** Supabase SQL + `scripts/processing/process_matches.py` + `data/static/item.json`
- [x] Criar tabela `champion_builds` no Supabase (champion_name, item_id, item_name, pick_count, win_count, patch) + UNIQUE (champion_name, item_id, patch)
- [x] `item.json` já existia em `data/static/` (v16.4.1, 688 itens)
- [x] `_get_item_dict()` com lazy cache (lê o JSON uma vez por processo)
- [x] `extrair_builds_partida(match_json, item_dict)` — função pura, ignora slots 0, ignora IDs fora do dict, ignora bots
- [x] `processar_partida()` chama RPC `upsert_champion_builds` — atomic ON CONFLICT DO UPDATE
- [x] View SQL `champion_item_stats` com winrate_pct calculado automaticamente
- [x] `tests/test_process_builds.py` — 16 testes passando

---

### [André] Prompt Engineering com o Llama 3
**Arquivos:** `backend/services/llm_service.py` + `backend/prompts/system_prompt.txt`
- [ ] Escrever `system_prompt.txt` ("Você é Metis, o estrategista. Nunca alucine. Responda APENAS com base no contexto.")
- [ ] Criar `llm_service.py` montando: System Prompt + Contexto (do RAG) + Pergunta do Usuário
- [ ] Configurar `temperature=0.1` (respostas analíticas e determinísticas)
- [ ] Retornar string gerada para a rota `POST /api/v1/chat`

---

### [Done ✅] Tela de Chat e Autenticação no Next.js (v0.4 + v0.5)
**Arquivos:** `frontend/src/app/auth/` + `frontend/src/app/chat/` + `frontend/src/app/page.tsx` + `frontend/src/app/players/[puuid]/`
- [x] `package.json` com next 15, @supabase/ssr, lucide-react, tailwindcss — `npm install` OK
- [x] `src/lib/supabase/client.ts` — `createBrowserClient` para componentes client
- [x] `src/lib/supabase/server.ts` — `createServerClient` com cookies para Server Components
- [x] `src/middleware.ts` — refresh de sessão + redirect: /chat sem auth → /auth; /auth com auth → /
- [x] `src/app/page.tsx` — home pública: busca de jogador + lista de supervisão (watched_players)
- [x] `src/app/auth/page.tsx` — Login Email/Senha via Supabase Auth, redirect para /
- [x] `src/app/chat/page.tsx` — gate premium (app_metadata.is_premium), chat com FastAPI
- [x] `src/app/players/[puuid]/page.tsx` — stats públicas placeholder + toggle supervisão (Star/StarOff + label)
- [x] Supabase `watched_players` — tabela + RLS + UNIQUE(user_id, puuid)
- [x] `src/components/ui/ChatInput.tsx` — textarea + botão Send (lucide), Enter para enviar
- [x] `src/components/ui/ChatMessage.tsx` — bolha user (azul) vs metis (surface), avatares
- [x] `npx tsc --noEmit` — zero erros TypeScript
- [ ] Deploy no Vercel (pendente: Takida configura env vars + domínio)
- [ ] Concessão premium: `auth.admin.updateUserById(userId, { app_metadata: { is_premium: true } })` via service role

### [Takis] Lógica de Login (Supabase + FastAPI)
**Arquivos:** `frontend/src/app/auth/` + `backend/core/security.py`
**Libs Frontend:** `@supabase/supabase-js`, `@supabase/ssr` | **Backend:** `fastapi`, `python-jose`
- [ ] Página de Login e Cadastro (Email/Senha ou Google)
- [ ] Salvar sessão via Supabase SSR (Cookies)
- [ ] Interceptador: adicionar `Authorization: Bearer <TOKEN>` em todo fetch
- [ ] FastAPI: dependência `get_current_user` lendo o header
- [ ] Validar token com chave pública Supabase → retornar 401 se inválido

### [Done ✅] Separação de Dados Sujos + Paginação (v0.6.3)
- [x] Tabela `matches_dirty` no Supabase (reason + snapshot JSON + RLS)
- [x] `riot_service.py` — filtro SoloQ/Flex (420/440) + remake/short_game → matches_dirty
- [x] `GET /api/v1/player/history` com `offset` + `has_more`
- [x] Player page — carga inicial 15, botão "Carregar mais" (+10), badge SoloQ/Flex

### [Done ✅] Tela de Histórico de Partidas do Jogador
**Arquivos:** `frontend/src/app/players/[puuid]/page.tsx` + `frontend/src/components/matches/MatchCard.tsx`
- [x] Fetch em `GET /api/v1/player/history?puuid=&limit=10`
- [x] Componente `MatchCard` (Resultado, Campeão via Data Dragon CDN, KDA, Ouro, DPM, duração)
- [x] Azul = Vitória, vermelho = Derrota
- [x] Botão "Analisar" → `/chat?match_id=&puuid=`
- [x] Toggle supervisão (Star/StarOff) com label livre, watch via `watched_players`
- [x] Backend: `GET /api/v1/player/history` com nested select PostgREST

### [Done ✅] Tela de Estatísticas Globais (Tier List / Meta)
**Arquivos:** `frontend/src/app/champions/page.tsx` + `frontend/src/components/stats/StatsTable.tsx`
- [x] Rota `/champions` no Next.js
- [x] Fetch em `GET /api/v1/stats/tierlist` com filtros role/server/patch
- [x] Tabela sortável por qualquer coluna (click header, toggle asc/desc)
- [x] Ícone do campeão via Data Dragon CDN
- [x] Winrate: verde > 51%, vermelho < 49%
- [x] Filtros: role (botões), servidor (select), patch (input), elo (emblemas Data Dragon, UI-only)
- [x] Backend: `GET /api/v1/stats/tierlist` + `buscar_tierlist()` em `stats_service.py`
- [ ] Cores percentil (top/bottom 25%) por coluna — pendente
- [ ] Badge "baixa amostra" para campeões com poucos dados no filtro — pendente

---

## 🔒 [Depende de Outras Tarefas]

### Vetorização dos Guias (Camada Ouro)
**Bloqueio:** Depende de Mobafire scraper (PUC Zaras) e process_matches (PUC Zaras)
**Arquivos:** `scripts/ouro/vectorize_guides.py` + `.github/workflows/vetorizacao_diaria.yml`
**Libs:** `boto3`, `openrag`, `supabase`, `python-dotenv`
- [ ] Criar `.yml` no Actions (cron `'0 3 * * *'`)
- [ ] `boto3` para listar/baixar HTMLs do R2 (Camada Bronze)
- [ ] Parse do JSON nativo + iterar sobre array de chapters
- [ ] Passar `chapter['content']` pelo pipeline OpenRAG (chunking)
- [ ] Vetorizar blocos com OpenRAG → embeddings
- [ ] UPSERT na `guides_gold`: texto + metadados (campeão, patch, autor) + vetor embedding

### Conectar o FastAPI com o Supabase (Busca Semântica)
**Bloqueio:** Depende de Vetorização dos Guias
**Arquivos:** `backend/services/rag_service.py` + SQL Editor Supabase
**Libs:** `openrag`, `supabase`
- [ ] Criar função RPC `match_documents` no Supabase (operador `<->` pgvector)
- [ ] `rag_service.py`: receber string da pergunta
- [ ] Vetorizar a pergunta com OpenRAG (mesmo modelo da ingestão)
- [ ] Chamar `supabase.rpc('match_documents', {'query_embedding': vetor, 'match_threshold': 0.78, 'match_count': 3})`
- [ ] Extrair texto dos resultados e formatar bloco de Contexto para o FastAPI

---

## 🆓 [Pegue Suas Tarefas]

### Data Lake Local (Estruturação)
**Status:** Aberto / Sem dono definido

---

## 🧪 [Done ✅] Testes Funcionais — API Metis (M5)

**Status:** 28/28 passando — `tests/test_funcionais_api_metis.py`

#### Health Check
- [x] `GET /api/v1/health` → 200 `{"status": "online", "system": "Metis"}`

#### POST /api/v1/player/sync
- [x] Request válido `{"riot_id":"Faker#KR1","server":"KR","count":5}` → 200
- [x] Sem `#` no riot_id → 400 "Formato inválido"
- [x] Nick vazio `{"riot_id":"#KR1"}` → 400 "Nome e Tag não podem ser vazios"
- [x] Tag vazia `{"riot_id":"Faker#"}` → 400
- [x] Ambos vazios `{"riot_id":"#"}` → 400

#### GET /api/v1/stats/champions
- [x] `?champion=Ahri` → 200
- [x] `?champion=Ahri&role=MIDDLE` → 200 filtrado
- [x] `?champion=Ahri&server=BR1` → 200 filtrado
- [x] `?champion=Ahri&elo=DIAMOND` → 200 filtrado
- [x] `?champion=Ahri&patch=14.5` → 200 filtrado
- [x] Todos os filtros combinados → 200
- [x] `min_matches=99999` → 200 com `stats: null`
- [x] Sem parâmetro champion → 422
- [x] `?champion=XYZ` (inexistente) → 200 com `total_matches: 0`
- [x] `min_matches=0` → 422 (mínimo 1)
- [x] `?champion=ahri` (minúsculo) → 200 (ilike case-insensitive)

#### POST /api/v1/player/update-history
- [x] Request válido `{"nick":"Faker","tag":"KR1","server":"KR","count":5}` → 200
- [x] Nick vazio → 404 jogador não encontrado
- [x] Count = 0 → 422
- [x] Count = 25 → 422 (máximo 20)
- [x] Servidor inválido `"server":"XYZ"` → 500 ValueError
- [x] Sem RIOT_API_KEY → 500 RuntimeError

#### CORS & Exception Handling
- [x] Request de `localhost:3000` → aceito
- [x] Request de origem não permitida → bloqueado
- [x] Supabase indisponível → 500 com detail JSON, sem crash
- [x] Riot API 429 (rate limit) → 429 com mensagem amigável
- [x] Riot API 403 (key expirada) → 502 com detail legível
