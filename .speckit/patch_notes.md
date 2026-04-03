# Metis - Patch Notes

*Diário de mudanças significativas no ecossistema e na stack do projeto.*

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
