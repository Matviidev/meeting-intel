create extension if not exists vector;

create table meetings (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  title text not null,
  occurred_on date,
  source_name text not null,
  content text not null,
  utterances jsonb not null,
  duration_sec integer not null,
  speakers jsonb not null,
  insights jsonb not null,
  created_at timestamptz not null default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  ordinal integer not null,
  start_sec integer not null,
  end_sec integer not null,
  speakers text[] not null,
  content text not null,
  embedding vector(384) not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored
);

create index chunks_meeting_idx on chunks (meeting_id);
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_tsv_idx on chunks using gin (tsv);
create index chunks_speakers_idx on chunks using gin (speakers);

create table action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  ordinal integer not null,
  owner text,
  task text not null,
  due text,
  at_sec integer,
  status text not null default 'open' check (status in ('open', 'done')),
  updated_at timestamptz not null default now()
);

create index action_items_meeting_idx on action_items (meeting_id);

create table traces (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  scope jsonb not null,
  retrieved jsonb not null,
  answer text not null default '',
  flags jsonb not null,
  model text not null,
  latency_ms integer,
  first_token_ms integer,
  input_tokens integer,
  output_tokens integer,
  feedback real,
  created_at timestamptz not null default now()
);

create index traces_created_idx on traces (created_at desc);
