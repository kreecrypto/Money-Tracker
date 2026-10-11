-- Image-only Shortcuts: persist raw server-side OCR privately for authorized review.
-- Additive and safe on legacy text-only drafts; NO production schema change until release gates pass.
alter table public.money_tracker_iphone_drafts
  add column if not exists ocr_text text
    check (ocr_text is null or char_length(ocr_text) <= 20000);

comment on column public.money_tracker_iphone_drafts.ocr_text is
  'Private OCR text from explicitly uploaded image slips; may contain bank account numbers or balances. Server/service-role only. Not exposed to Shortcuts responses.';

-- Keep RLS enabled and direct anon/authenticated access denied, also on new column.
alter table public.money_tracker_iphone_drafts enable row level security;
revoke all on public.money_tracker_iphone_drafts from anon, authenticated;
grant all on public.money_tracker_iphone_drafts to service_role;
