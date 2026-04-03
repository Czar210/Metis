# Metis - Registro de Bugfixes Punitivos

*Documento dedicado ao registro de débitos técnicos e falhas que bloqueiam o andamento de novas features.*

## Blockers Abertos (Resolver ANTES de prosseguir)
- Nenhum no momento.

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
