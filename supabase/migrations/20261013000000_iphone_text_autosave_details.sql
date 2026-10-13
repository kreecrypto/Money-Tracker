-- Persist only extracted structured transaction metadata. Raw OCR text and images
-- are deliberately not retained. Compatible with earlier pending-review rows.
ALTER TABLE public.money_tracker_iphone_drafts
  ADD COLUMN IF NOT EXISTS transaction_time text,
  ADD COLUMN IF NOT EXISTS recipient text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='iphone_drafts_time_format'
  ) THEN
    ALTER TABLE public.money_tracker_iphone_drafts
      ADD CONSTRAINT iphone_drafts_time_format
      CHECK (transaction_time IS NULL OR transaction_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='iphone_drafts_recipient_length'
  ) THEN
    ALTER TABLE public.money_tracker_iphone_drafts
      ADD CONSTRAINT iphone_drafts_recipient_length
      CHECK (recipient IS NULL OR length(recipient)<=160);
  END IF;
END $$;
