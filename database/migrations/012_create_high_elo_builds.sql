-- Migration 012 - Builds agregadas de partidas high-elo

create table if not exists high_elo_builds (
    id              uuid        default gen_random_uuid() primary key,
    champion_name   varchar(100) not null,
    role            varchar(20)  not null,
    patch_version   varchar(10)  not null,
    items           text[]       not null,
    winrate         float        not null,
    sample_size     int          not null,
    content         text         not null,
    embedding       vector(768),
    created_at      timestamptz  default now(),
    unique (champion_name, role, patch_version)
);

create index if not exists high_elo_builds_embedding_idx
    on high_elo_builds using hnsw (embedding vector_cosine_ops);

create index if not exists high_elo_builds_champion_idx
    on high_elo_builds (champion_name);

create or replace function match_high_elo_builds(
    query_embedding vector(768),
    match_count     int     default 5,
    champion_filter varchar default null
)
returns table (
    champion_name varchar,
    role          varchar,
    patch_version varchar,
    items         text[],
    winrate       float,
    sample_size   int,
    content       text,
    similarity    float
)
language sql stable
as $$
    select
        champion_name,
        role,
        patch_version,
        items,
        winrate,
        sample_size,
        content,
        1 - (embedding <=> query_embedding) as similarity
    from high_elo_builds
    where champion_filter is null or champion_name ilike champion_filter
    order by embedding <=> query_embedding
    limit match_count;
$$;
