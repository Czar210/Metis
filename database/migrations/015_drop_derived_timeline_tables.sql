-- Migration 015 — Remove tabelas derivadas de timeline para aliviar o Supabase
--
-- critical_events (1.24M rows) e participant_snapshots (91K rows) são dados
-- derivados dos arquivos timelines/ que já existem no Cloudflare R2.
-- Nenhum endpoint FastAPI as consome. A fonte de verdade permanece intacta no R2.
--
-- Alívio estimado: ~560MB → Supabase volta de 535MB para ~100MB/500MB.
--
-- NOTA: match_timelines (168 rows) é mantida — ela é cache ativo do endpoint
-- GET /api/v1/match/{id}/timeline. Migrar para R2 é trabalho separado (Fase 1).
--
-- Após aplicar: rodar migration 014 (se não aplicada) e depois o pipeline
-- process_matches para repopular champion_builds com role.

-- death_analyses e objective_analyses têm FK para critical_events
DROP TABLE IF EXISTS death_analyses;
DROP TABLE IF EXISTS objective_analyses;
DROP TABLE IF EXISTS critical_events;
DROP TABLE IF EXISTS participant_snapshots;
