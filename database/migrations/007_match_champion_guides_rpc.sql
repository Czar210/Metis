-- Migration 007 — RPC para busca vetorial no chat RAG

create or replace function match_champion_guides(
  query_embedding vector(768),
  match_count     int default 5
)
returns table (
  champion_name varchar,
  chapter_title varchar,
  chunk_index   int,
  content       text,
  similarity    float
)
language sql stable
as $$
  select
    champion_name,
    chapter_title,
    chunk_index,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from champion_guides
  order by embedding <=> query_embedding
  limit match_count;
$$;
