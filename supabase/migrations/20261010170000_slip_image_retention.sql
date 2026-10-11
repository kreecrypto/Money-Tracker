-- Additive seven-day bank-slip evidence metadata, preserving old structured drafts.
alter table public.money_tracker_iphone_drafts
  add column if not exists image_status text not null default 'none'
    check (image_status in ('none','uploading','available','upload_failed','deleting','deleted','delete_failed')),
  add column if not exists image_bucket text,
  add column if not exists image_path text,
  add column if not exists image_mime text,
  add column if not exists image_size_bytes integer
    check (image_size_bytes between 1 and 3145728),
  add column if not exists image_uploaded_at timestamptz,
  add column if not exists image_expires_at timestamptz,
  add column if not exists image_deleted_at timestamptz,
  add column if not exists image_delete_attempts integer not null default 0,
  add column if not exists image_last_error_code text;
create unique index if not exists uniq_money_tracker_iphone_image_path
  on public.money_tracker_iphone_drafts(image_path) where image_path is not null;
create index if not exists idx_money_tracker_iphone_image_purge
  on public.money_tracker_iphone_drafts(image_expires_at,image_status)
  where image_path is not null;
alter table public.money_tracker_iphone_drafts enable row level security;
revoke all on public.money_tracker_iphone_drafts from anon, authenticated;
grant all on public.money_tracker_iphone_drafts to service_role;
comment on column public.money_tracker_iphone_drafts.image_expires_at is
  'Strict visibility cutoff exactly 168 hours after image upload. Physical purge is retried hourly.';
