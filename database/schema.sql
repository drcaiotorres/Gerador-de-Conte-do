
-- Rode isso no SQL Editor do Supabase

create extension if not exists vector;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz default now()
);

create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  prompt_geral text,
  prompt_reels text,
  prompt_post text,
  prompt_carrossel text,
  prompt_live text,
  prompt_stories text,
  anexos_geral jsonb,
  anexos_reels jsonb,
  anexos_post jsonb,
  anexos_carrossel jsonb,
  anexos_live jsonb,
  anexos_stories jsonb,
  updated_at timestamptz default now()
);

create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  semana_iso text,
  tema_central text,
  subtemas jsonb,
  tags jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  texto text,
  tags jsonb,
  embedding vector(1536),
  created_at timestamptz default now()
);

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  week_id uuid references weeks(id),
  training_id_ref uuid references trainings(id),
  status text check (status in ('draft','final','archived')) default 'draft',
  payload jsonb,
  edited_payload jsonb,
  created_at timestamptz default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid references generations(id),
  tipo text,
  indice int,
  content_json jsonb,
  edited_json jsonb,
  tags jsonb,
  feedbacks jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists generation_versions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid references generations(id),
  label text,
  payload jsonb,
  edited_payload jsonb,
  created_at timestamptz default now()
);

create or replace function match_ideas(query_embedding vector(1536), match_count int default 20)
returns table(id uuid, texto text, score float)
language sql stable parallel safe as $$
  select i.id, i.texto, 1 - (i.embedding <=> query_embedding) as score
  from ideas i
  order by i.embedding <-> query_embedding
  limit match_count;
$$;

create index if not exists ideas_embedding_idx
  on ideas using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
