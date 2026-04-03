# Metis - Plano Atual (Milestones Tracker)

*Sincronizado com Trello Oficial — última sync: 2026-04-02*
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

### [Revisão ✅] Endpoint FastAPI - Sincronizar Partidas do Jogador
- [x] Rota `POST /api/v1/player/sync` recebendo Riot ID (ex: `Zaras#0210`)
- [x] RiotWatcher para descobrir PUUID
- [x] Buscar IDs das últimas partidas via `match.matchlist_by_puuid`
- [x] Download dos dados detalhados por Match ID
- [x] Filtrar remakes e partidas < 15 min
- [x] UPSERT na tabela `matches` do Supabase

### [Revisão ✅] Endpoint FastAPI - Estatísticas Médias de Campeões
- [x] Rota `GET /api/v1/stats/champions`
- [x] Query SQL agregada por campeão (winrate, avg_kda, avg_gold)
- [x] Filtros via Query Params (`?elo=diamond`, `?patch=14.5`, etc.)
- [x] Retorno JSON estruturado

---

## 🔄 Tickets Ativos

### [PUC Zaras] Script de Limpeza de Partidas (Bronze → Prata)
**Arquivo:** `scripts/processing/process_matches.py`
- [x] Criar a lógica de limpeza
- [ ] **Montar o Loop** ← próximo passo
- [ ] Subir como GitHub Action
- [ ] Bugfix

### [PUC Zaras] Automatizar a Raspagem do Mobafire + Bugfix
**Descrição:** Playwright rodando via GitHub Actions 1x/semana, salvando HTML bruto no R2 (Camada Bronze).
- [ ] Corrigir bug existente no script Playwright
- [ ] Configurar GitHub Action com schedule semanal
- [ ] Validar upload no R2

### [PUC Zaras] Modelagem e Ingestão de Itens (Builds dos Campeões)
**Arquivos:** Supabase SQL + `scripts/prata/process_matches.py` + `data/static/item.json`
- [ ] Criar tabela `champion_builds` no Supabase (champion_name, item_id, item_name, pick_count, win_count, patch)
- [ ] Baixar `item.json` do Data Dragon (mapear IDs → nomes, ex: 3078 = Força da Trindade)
- [ ] Atualizar `process_matches.py` para extrair os 6 itens de cada jogador (item0–item5)
- [ ] UPSERT das contagens na tabela `champion_builds`
- [ ] (Opcional) View SQL: Winrate e Pickrate por item/campeão

---

### [André] Prompt Engineering com o Llama 3
**Arquivos:** `backend/services/llm_service.py` + `backend/prompts/system_prompt.txt`
- [ ] Escrever `system_prompt.txt` ("Você é Metis, o estrategista. Nunca alucine. Responda APENAS com base no contexto.")
- [ ] Criar `llm_service.py` montando: System Prompt + Contexto (do RAG) + Pergunta do Usuário
- [ ] Configurar `temperature=0.1` (respostas analíticas e determinísticas)
- [ ] Retornar string gerada para a rota `POST /api/v1/chat`

---

### [Takis] Tela de Chat e Autenticação no Next.js
**Arquivos:** `frontend/src/app/auth/` + `frontend/src/app/chat/` + `frontend/src/components/ui/`
**Libs:** `next`, `react`, `@supabase/supabase-js`, `@supabase/ssr`, `tailwindcss`, `lucide-react`
- [ ] Instalar libs e inicializar cliente Supabase com `NEXT_PUBLIC_SUPABASE_URL` e `ANON_KEY`
- [ ] Criar página de Login (Email/Senha) e lógica de sessão
- [ ] Componente de input + botão Enviar (ícone lucide-react)
- [ ] Gerenciar estado das mensagens com `useState`
- [ ] `fetch POST` para o FastAPI no Railway ao enviar
- [ ] Capturar resposta e atualizar tela com a resposta do Metis
- [ ] Deploy no Vercel

### [Takis] Lógica de Login (Supabase + FastAPI)
**Arquivos:** `frontend/src/app/auth/` + `backend/core/security.py`
**Libs Frontend:** `@supabase/supabase-js`, `@supabase/ssr` | **Backend:** `fastapi`, `python-jose`
- [ ] Página de Login e Cadastro (Email/Senha ou Google)
- [ ] Salvar sessão via Supabase SSR (Cookies)
- [ ] Interceptador: adicionar `Authorization: Bearer <TOKEN>` em todo fetch
- [ ] FastAPI: dependência `get_current_user` lendo o header
- [ ] Validar token com chave pública Supabase → retornar 401 se inválido

### [Takis] Tela de Histórico de Partidas do Jogador
**Arquivos:** `frontend/src/app/history/` + `frontend/src/components/matches/MatchCard.tsx`
**Libs:** `next`, `react`, `tailwindcss`, `date-fns`, `lucide-react`
- [ ] Criar rota `/history` no Next.js
- [ ] Fetch na API para buscar lista de partidas do jogador
- [ ] Componente `MatchCard` (Resultado, Campeão, KDA, Ouro)
- [ ] Estilização dinâmica: azul = Vitória, vermelho = Derrota
- [ ] Botão "Analisar com Metis" → joga dados da partida pro chat

### [Takis] Tela de Estatísticas Globais (Tier List / Meta)
**Arquivos:** `frontend/src/app/champions/` + `frontend/src/components/stats/StatsTable.tsx`
**Libs:** `next`, `react`, `recharts` ou `chart.js`, `clsx`, `tailwind-merge`
- [ ] Criar rota `/champions` no Next.js
- [ ] Fetch em `GET /api/v1/stats/champions`
- [ ] Tabela: Ícone, Nome, Winrate (%), Pickrate, Banrate
- [ ] Ordenação por coluna (click no header)
- [ ] Cores: vermelho < 49%, verde > 51%

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

## 🧪 [Revisão — César + Claude] Testes Funcionais — API Metis

**Status:** Checklist toda pendente — prioridade do M5

#### Health Check
- [ ] `GET /api/v1/health` → 200 `{"status": "online", "system": "Metis"}`

#### POST /api/v1/player/sync
- [ ] Request válido `{"riot_id":"Faker#KR1","server":"KR","count":5}` → 200
- [ ] Sem `#` no riot_id → 400 "Formato inválido"
- [ ] Nick vazio `{"riot_id":"#KR1"}` → 400 "Nome e Tag não podem ser vazios"
- [ ] Tag vazia `{"riot_id":"Faker#"}` → 400
- [ ] Ambos vazios `{"riot_id":"#"}` → 400

#### GET /api/v1/stats/champions
- [ ] `?champion=Ahri` → 200
- [ ] `?champion=Ahri&role=MIDDLE` → 200 filtrado
- [ ] `?champion=Ahri&server=BR1` → 200 filtrado
- [ ] `?champion=Ahri&elo=DIAMOND` → 200 filtrado
- [ ] `?champion=Ahri&patch=14.5` → 200 filtrado
- [ ] Todos os filtros combinados → 200
- [ ] `min_matches=99999` → 200 com `total_matches: 0`
- [ ] Sem parâmetro champion → 422
- [ ] `?champion=XYZ` (inexistente) → 200 com `total_matches: 0`
- [ ] `min_matches=0` → 422 (mínimo 1)
- [ ] `?champion=ahri` (minúsculo) → 200 (ilike case-insensitive)

#### POST /api/v1/player/update-history
- [ ] Request válido `{"nick":"Faker","tag":"KR1","server":"KR","count":5}` → 200
- [ ] Nick vazio → 404 jogador não encontrado
- [ ] Count = 0 → 422
- [ ] Count = 25 → 422 (máximo 20)
- [ ] Servidor inválido `"server":"XYZ"` → 500 ValueError
- [ ] Sem RIOT_API_KEY → 500 RuntimeError

#### CORS & Exception Handling
- [ ] Request de `localhost:3000` → aceito
- [ ] Request de origem não permitida → bloqueado
- [ ] Supabase indisponível → erro claro, sem crash
- [ ] Riot API 429 (rate limit) → mensagem amigável
- [ ] Riot API 403 (key expirada) → mensagem amigável
