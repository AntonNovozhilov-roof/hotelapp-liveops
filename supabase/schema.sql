-- HotelApp LiveOps — Supabase schema (M2 / ANT-18)
-- Run this ONCE in the Supabase dashboard: SQL Editor -> New query -> paste
-- this whole file -> Run. It is safe to run again (nothing is duplicated
-- or deleted). The matching Vercel region is iad1 (Washington) and the
-- Supabase project "readybell" is in East US (North Virginia).
--
-- How the app uses this: collections (tasks, history, reports, hotel data,
-- employees, bookings, conversations) are one JSONB document per kind in
-- app_documents — the exact shapes the app already used in .data/*.json.
-- Counters that must be correct on several servers get their own tables.
-- Row Level Security is ON for every table with NO public policies: the
-- public/anon keys can read and write nothing. Only the server-side
-- connection (DATABASE_URL, transaction pooler port 6543) and the Storage
-- service_role key — both server-only secrets — can touch the data.

create table if not exists public.app_documents (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Daily AI cap (all kinds together), one row per day. Incremented
-- atomically in src/lib/security.ts (consumeAiCall).
create table if not exists public.ai_daily_counters (
  day date primary key,
  count integer not null default 0
);

-- AI usage card: one row per day and kind (guestChat/photoChecks/reports/voice).
create table if not exists public.ai_usage_daily (
  day date not null,
  kind text not null,
  count integer not null default 0,
  primary key (day, kind)
);

-- Sliding-window rate-limit hits (guest text/voice, login failures).
create table if not exists public.rate_limit_hits (
  key text not null,
  hit_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_key_time
  on public.rate_limit_hits (key, hit_at);

-- Photo-check result cache (PC1): same photo + prompt is never re-checked.
create table if not exists public.photo_check_cache (
  kind text not null,
  cache_key text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (kind, cache_key)
);

-- Row Level Security ON, no policies = no access for anon/public keys.
alter table public.app_documents enable row level security;
alter table public.ai_daily_counters enable row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.rate_limit_hits enable row level security;
alter table public.photo_check_cache enable row level security;

-- PRIVATE photo bucket (task photos + perfect-room reference photos).
-- public = false: guests and the public can never open these files
-- directly. The app serves them only through its sign-in-checked
-- /api/photos/[name] route using the service key on the server.
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do update set public = false;
