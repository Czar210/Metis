-- Migration 010 - tabela patch_notes para campeoes, itens, runas e sistema

create extension if not exists vector;

create table if not exists patch_notes (
  id            uuid        default gen_random_uuid() primary key,
  patch_version varchar(10) not null,
  entity_type   varchar(20) not null,
  entity_name   varchar(100) not null,
  change_type   varchar(20) not null,
  description   text        not null,
  content       text        not null,
  embedding     vector(768),
  source_url    text,
  scraped_at    timestamptz default now(),
  unique (patch_version, entity_type, entity_name, change_type)
);

create index if not exists patch_notes_embedding_idx
  on patch_notes
  using hnsw (embedding vector_cosine_ops);

create index if not exists patch_notes_patch_entity_idx
  on patch_notes (patch_version, entity_type);

alter table patch_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'patch_notes' and policyname = 'Leitura publica de patch notes'
  ) then
    create policy "Leitura publica de patch notes"
      on patch_notes for select using (true);
  end if;
end $$;
