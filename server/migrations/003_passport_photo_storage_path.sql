-- Migration 003: Private passport photograph storage

-- Store the private Supabase object path against the payment.
ALTER TABLE public.admission_payments
ADD COLUMN IF NOT EXISTS passport_photo_path TEXT;

-- Store the permanent private storage path against the application.
ALTER TABLE public.admission_applications
ADD COLUMN IF NOT EXISTS passport_photo_path TEXT;

-- Preserve old photograph URLs but allow new applications
-- to use private storage paths instead.
ALTER TABLE public.admission_applications
ALTER COLUMN passport_photo_url DROP NOT NULL;

COMMENT ON COLUMN public.admission_payments.passport_photo_path
IS 'Private Supabase storage path associated with the verified application payment.';

COMMENT ON COLUMN public.admission_applications.passport_photo_path
IS 'Permanent object path of the applicant passport photograph in private Supabase storage.';