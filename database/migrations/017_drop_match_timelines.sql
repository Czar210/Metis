-- Migration 017 — Remove tabela match_timelines do Supabase
--
-- Os frames de timeline são agora armazenados no Cloudflare R2 como
-- timeline_frames/{match_id}.json.gz — mesmo formato, zero custo de storage no Supabase.
-- NOTA: timelines/ é o prefixo Bronze dos JSONs brutos da Riot API — NÃO usar para frames.
--
-- Pré-requisito: rodar o script de migração de dados
--   python -m scripts.processing.migrate_timelines_to_r2
-- para mover as 168 timelines existentes antes de dropar a tabela.

DROP TABLE IF EXISTS match_timelines;
