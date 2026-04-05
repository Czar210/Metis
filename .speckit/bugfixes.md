# Metis - Registro de Bugfixes Punitivos

*Documento dedicado ao registro de débitos técnicos e falhas que bloqueiam o andamento de novas features.*

## Blockers Abertos (Resolver ANTES de prosseguir)
- Nenhum no momento.

### [2026-04-04] BUG-017 — GitHub Actions — secrets com nomes errados + PYTHONPATH ausente + case-sensitive path
Três bugs distintos que impediam todos os workflows de rodar em CI:

1. **PYTHONPATH ausente:** `python -m scripts.*` falhava com `No module named scripts.*` porque o runner não sabia onde estava a raiz do projeto. **Resolvido** adicionando `PYTHONPATH: ${{ github.workspace }}` em todos os 6 workflows.

2. **Case-sensitive path:** `scripts/Processing/` (P maiúsculo) estava indexado no git mas o Python no Linux procurava `scripts/processing/` (p minúsculo). Windows é case-insensitive e nunca detectou o problema. **Resolvido** com `git rm --cached scripts/Processing/*.py` + `git add scripts/processing/*.py`.

3. **Nomes de secrets errados:** Workflows foram refatorados para `secrets.R2_ACCOUNT_ID` mas os secrets reais no GitHub sempre foram `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`. **Resolvido** revertendo os workflows para os nomes corretos.

4. **Supabase secrets ausentes:** `SUPABASE_URL` e `SUPABASE_KEY` não existiam no GitHub. **Resolvido** criando os dois secrets manualmente.

### [2026-04-03] BUG-009 — `riot_service.py` — `async def` bloqueante no event loop
- Rotas `/sync` e `/update-history` declaradas como `async def` mas chamam `atualizar_historico()`, que é bloqueante e usa `time.sleep(1.2)` por partida. Para 50 partidas = 60s+ de event loop travado. Toda a API ficava sem resposta durante um sync. **Resolvido** trocando ambas as rotas de `async def` para `def` em `player.py` (FastAPI roda em thread pool).

### [2026-04-03] BUG-010 — `riot_service.py` — `maybe_single()` retorna 406 com PUUID duplicado
- `maybe_single()` na verificação de cooldown (`atualizar_historico`) retorna HTTP 406 quando há múltiplos registros para o mesmo `game_name + tag_line` (ex: Zaras tem 2 PUUIDs no banco). Isso impedia qualquer sync do jogador. **Resolvido** substituindo `.maybe_single()` por `.limit(1).order("last_synced_at", desc=True, nullsfirst=False)` para pegar o registro mais recente de forma segura.

### [2026-04-03] BUG-011 — `riot_service.py` — `_match_exists` usa `maybe_single()` → 406 + NoneType
- A função `_match_exists` também usava `.maybe_single()` para checar existência de match nas tabelas `matches` e `matches_dirty`. Quando PostgREST retorna 406, o client retorna `None` e o `clean.data` explode com `AttributeError: 'NoneType' object has no attribute 'data'`. **Resolvido** trocando ambas as chamadas para `.limit(1)` com checagem de `bool(result.data)`.

### [2026-04-03] BUG-012 — Banco — PUUIDs duplicados (4 pares)
- 4 pares de jogadores com `game_name+tag_line` idênticos mas PUUIDs distintos (Zaras, Takida, monochaco, Wišadel). Causa: jogadores distintos que trocaram de Riot ID ao longo do tempo — ambos aparecem nos dados de partidas processadas. Em nenhum par os dois PUUIDs apareceram na mesma partida. **Resolvido** — deletados os 4 PUUIDs fantasmas (critério: menos match_participants) e seus 19 registros de match_participants associados. Banco sem duplicatas.

### [2026-04-03] BUG-008 — `requirements.txt` — encoding UTF-16 corrompido
- Arquivo gerado com BOM UTF-16 LE — cada caractere aparecia separado por espaço, `pip install` falhava silenciosamente em ambientes novos. **Resolvido** com `pip freeze` redirecionado via Python (UTF-8 sem BOM).

### [2026-04-03] BUG-007 — `riot_service.py` — import cross-package quebra Railway
- Linha 24: `from scripts.processing.process_matches import _normalizar_patch` — funciona localmente mas falha no container Railway onde `scripts` não está no PYTHONPATH. **Resolvido** inlining a função `_normalizar_patch` diretamente em `riot_service.py` e removendo o import.

## Bugs Resolvidos

### [2026-04-03] BUG-003, 004, 005 — `riot_service.py` (3 inconsistências vs process_matches.py)
- **BUG-003:** `game_version` salva no formato bruto "14.10.123.456" em vez de "14.10". **Resolvido** importando e aplicando `_normalizar_patch()` do `process_matches.py`.
- **BUG-004:** `team_position` None/vazio salvo como NULL em vez de "UNKNOWN". **Resolvido** com `p.get("teamPosition") or "UNKNOWN"`.
- **BUG-005:** `match_participants` upsert sem `on_conflict` → usava PK serial, criava duplicatas no re-sync. **Resolvido** com `on_conflict="match_id,puuid"`.

### [2026-04-03] BUG-006 — `stats.py` — 500 sem JSON no body
- Quando `_get_supabase()` lança `RuntimeError` (env vars ausentes), FastAPI retornava 500 com body vazio (não JSON). **Resolvido** com try/except no route handler convertendo para `HTTPException(500, detail=str(err))`.

### [2026-04-02] BUG-001 — `process_timelines.py` — Interface quebrada
- `create_client()` chamado no nível de módulo; importação em ambiente de testes crashava. **Resolvido** com refatoração: `extrair_dados_timeline()` pura + lazy init do `db_client`.

### [2026-04-02] BUG-002 — `scripts/Processing` — Case-sensitivity Windows
- Pasta com P maiúsculo impedia import em sistemas case-sensitive. **Resolvido** com rename via `cmd`.

### [2024-XX-XX] Bug de Documentação
- Documentação apontando para DB Vetorial obsoleto (Pinecone). **Resolvido** migrando descritivos para Supabase + pgvector.
