-- Dedicated MONEY TRACKER Supabase project only, never apply to unrelated projects.
-- Bank screenshots/OCR raw text are NEVER stored. Only private parsed drafts.
create table if not exists public.money_tracker_iphone_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null check (length(owner_key)=64),
  image_digest text not null check (length(image_digest)=64),
  bank_fingerprint text,
  status text not null default 'pending'
    check (status in ('pending','confirmed','discarded')),
  type text check (type in ('income','expense')),
  amount_satang bigint check (amount_satang>0 and amount_satang<=9007199254740991),
  transaction_date date,
  category text not null default 'อื่น ๆ' check (length(category)<=80),
  note text not null default '' check (length(note)<=500),
  method text not null default 'bank' check (method in ('cash','bank','card','wallet')),
  source_label text not null default 'iPhone Shortcut'
    check (length(source_label)<=90),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (owner_key,image_digest)
);
create unique index if not exists uniq_iphone_owner_bank_fingerprint
  on public.money_tracker_iphone_drafts (owner_key,bank_fingerprint)
  where bank_fingerprint is not null and status <> 'discarded';
create index if not exists idx_iphone_owner_pending
  on public.money_tracker_iphone_drafts (owner_key,status,created_at desc);
alter table public.money_tracker_iphone_drafts enable row level security;
revoke all on public.money_tracker_iphone_drafts from anon,authenticated;
grant all on public.money_tracker_iphone_drafts to service_role;
comment on table public.money_tracker_iphone_drafts is
 'Private screenshot-derived bank review queue for single-owner iPhone Shortcuts integration. No raw OCR/image or public RLS grants.';
