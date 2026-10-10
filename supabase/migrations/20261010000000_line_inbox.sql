-- Apply to a NEW, user-approved Money Tracker Supabase project only.
-- This is a staging inbox: it is NOT exposed to browser clients.
create table if not exists public.money_tracker_line_transactions (
  id uuid primary key default gen_random_uuid(),
  line_event_id text not null unique,
  line_user_id text not null,
  type text not null check (type in ('income','expense')),
  amount_satang bigint not null check (amount_satang > 0),
  category text not null,
  note text not null default '',
  method text not null check (method in ('cash','bank','card','wallet')),
  transaction_date date not null,
  created_at timestamptz not null default now(),
  constraint line_amount_limit check (amount_satang <= 9007199254740991),
  constraint line_event_length check (length(line_event_id) between 1 and 150),
  constraint line_user_length check (length(line_user_id) between 1 and 150),
  constraint line_note_length check (length(note) <= 500)
);
create index if not exists idx_money_tracker_line_user_date
  on public.money_tracker_line_transactions(line_user_id,transaction_date desc);
alter table public.money_tracker_line_transactions enable row level security;
revoke all on table public.money_tracker_line_transactions from anon,authenticated;
grant all on table public.money_tracker_line_transactions to service_role;
comment on table public.money_tracker_line_transactions is
  'Server-side LINE chat captures; no public access. Sync requires a separate authenticated account-linking flow.';
