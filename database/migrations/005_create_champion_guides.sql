-- Migration 005 — Camada Ouro: champion_guides (pgvector)
-- Pré-requisito: extensão vector habilitada no Supabase (Extensions → vector)

create extension if not exists vector with schema extensions;

-- Cria a tabela se ainda não existir (ambiente limpo)
create table if not exists champion_guides (
  id            serial        primary key,
  champion_name varchar       not null,
  author        varchar,
  tier_filter   varchar,
  chapter_title varchar       not null,
  content       text          not null,
  source_file   varchar       not null,
  embedding     vector(768),
  created_at    timestamptz   default now()
);

-- Adiciona colunas que podem estar faltando se a tabela já existia
alter table champion_guides add column if not exists source_file varchar;
alter table champion_guides add column if not exists created_at timestamptz default now();

-- Corrige dimensão do embedding de 1536 → 768 (Gemini text-embedding-004)
-- Só executa se a coluna ainda for vector(1536)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'champion_guides'
      and column_name = 'embedding'
      and udt_name = 'vector'
  ) then
    alter table champion_guides alter column embedding type vector(768)
      using embedding::text::vector(768);
  end if;
end $$;

-- Idempotência: source_file (chave R2) + chapter_title identificam o chunk unicamente
create unique index if not exists champion_guides_source_chapter_idx
  on champion_guides (source_file, chapter_title);

-- HNSW: não precisa de dados pré-existentes, melhor recall em datasets pequenos
create index if not exists champion_guides_embedding_idx
  on champion_guides using hnsw (embedding vector_cosine_ops);

-- RLS: leitura pública (guias são conteúdo aberto), escrita bloqueada para clientes externos
alter table champion_guides enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'champion_guides'
      and policyname = 'Leitura pública de guias'
  ) then
    execute 'create policy "Leitura pública de guias" on champion_guides for select using (true)';
  end if;
end $$;

-- Inserts/updates só via service_role (GitHub Actions usa SUPABASE_KEY = service_role)
-- Nenhuma policy de insert/update/delete = bloqueado para anon e authenticated
