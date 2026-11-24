-- OAuth refresh tokens and session hashes are backend-only.
-- No anon or authenticated grants and no RLS policies: service role access only.
create table if not exists public.money_tracker_gmail_connections (
  google_sub text primary key check (length(google_sub) between 4 and 255),
  email text not null check (length(email) between 5 and 255),
  encrypted_refresh_token text not null check (length(encrypted_refresh_token) > 30),
  session_hash text not null unique check (session_hash ~ '^[0-9a-f]{64}$'),
  session_expires_at timestamptz not null,
  linked_at timestamptz not null default now()
);
alter table public.money_tracker_gmail_connections enable row level security;
revoke all on table public.money_tracker_gmail_connections from public, anon, authenticated;
comment on table public.money_tracker_gmail_connections is
  'Private OAuth refresh tokens and opaque cookie session hashes for in-app Gmail linking.';
