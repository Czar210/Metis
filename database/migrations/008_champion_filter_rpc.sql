-- Migration 008 — RPC com filtro opcional por campeão
-- Remove versão anterior (sem champion_filter) para evitar overload ambíguo
drop function if exists match_champion_guides(vector, integer);

create or replace function match_champion_guides(
  query_embedding  vector(768),
  match_count      int     default 5,
  champion_filter  varchar default null
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
  where champion_filter is null
     or champion_name ilike champion_filter
  order by embedding <=> query_embedding
  limit match_count;
$$;
