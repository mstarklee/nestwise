-- One-time setup for the spike's tables (already applied to the Supabase dev database on 2026-11-02).
-- Row-level security on with no policies, so the Supabase Data API sees nothing.
create table if not exists public.spike_users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.spike_sessions (
  token_hash text primary key,
  user_id uuid not null references public.spike_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists public.spike_entries (
  id uuid primary key,
  user_id uuid not null,
  note text not null,
  client_created_at timestamptz not null,
  received_at timestamptz not null default now()
);
create table if not exists public.spike_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.spike_users enable row level security;
alter table public.spike_sessions enable row level security;
alter table public.spike_entries enable row level security;
alter table public.spike_push_subscriptions enable row level security;
