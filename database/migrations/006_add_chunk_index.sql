-- Migration 006 — Chunking inteligente: adiciona chunk_index e reprocessa dados

-- Adiciona coluna chunk_index (default 0 para compatibilidade)
alter table champion_guides add column if not exists chunk_index integer not null default 0;

-- Remove índice antigo (source_file, chapter_title) — não distingue sub-chunks
drop index if exists champion_guides_source_chapter_idx;

-- Novo índice único inclui chunk_index
create unique index if not exists champion_guides_source_chapter_chunk_idx
  on champion_guides (source_file, chapter_title, chunk_index);

-- Limpa dados antigos com chunks gigantes para reprocessamento completo
truncate table champion_guides;
