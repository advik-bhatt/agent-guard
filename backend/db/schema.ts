// Provider-neutral schema. Runs on any Postgres (Replit, Neon, RDS, local…).
// Applied idempotently on startup when DATABASE_URL is set.
export const SCHEMA_SQL = `
create table if not exists agents (
  id           serial primary key,
  agent_id     bigint unique,
  name         text not null,
  role         text not null,
  wallet       text,
  agent_uri    text,
  created_at   timestamptz not null default now()
);

create table if not exists tasks (
  id               serial primary key,
  onchain_id       bigint,
  poster           text,
  worker_agent_id  bigint,
  title            text,
  description      text not null,
  bounty_mnt       numeric not null default 0,
  status           text not null default 'open',
  score            int,
  approved         boolean,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists task_events (
  id          serial primary key,
  task_id     int references tasks(id) on delete cascade,
  type        text not null,
  message     text,
  tx_hash     text,
  simulated   boolean default false,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists reputation_events (
  id          serial primary key,
  agent_id    bigint not null,
  task_id     int,
  score       int not null,
  tag1        text,
  tag2        text,
  tx_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_rep_agent  on reputation_events(agent_id);
create index if not exists idx_events_task on task_events(task_id);
create index if not exists idx_tasks_status on tasks(status);
`;
