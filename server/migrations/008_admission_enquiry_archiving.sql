-- SKYROUTING ADMISSION ENQUIRY ARCHIVING
-- Migration: 008_admission_enquiry_archiving

BEGIN;

ALTER TABLE public.admission_enquiries
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS
    idx_admission_enquiries_archived_at
ON public.admission_enquiries (archived_at);

COMMENT ON COLUMN public.admission_enquiries.archived_at
IS 'Timestamp when an admission enquiry was archived. NULL means the enquiry is active.';

COMMIT;
