-- Migration 011 - RPC para busca vetorial em patch_notes

create or replace function match_patch_notes(
  query_embedding vector(768),
  match_count     int     default 5,
  entity_filter   varchar default null,
  type_filter     varchar default null
)
returns table (
  patch_version varchar,
  entity_type   varchar,
  entity_name   varchar,
  change_type   varchar,
  description   text,
  content       text,
  similarity    float
)
language sql stable
as $$
  select
    patch_version,
    entity_type,
    entity_name,
    change_type,
    description,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from patch_notes
  where (entity_filter is null or entity_name ilike entity_filter)
    and (type_filter   is null or entity_type = type_filter)
  order by embedding <=> query_embedding
  limit match_count;
$$;
