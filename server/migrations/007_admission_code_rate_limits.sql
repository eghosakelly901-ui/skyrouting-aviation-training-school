-- SKYROUTING PERSISTENT ADMISSION CODE RATE LIMITING
-- Migration: 007_admission_code_rate_limits

BEGIN;

CREATE TABLE IF NOT EXISTS public.admission_code_verification_attempts (
    client_key CHAR(64) PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempt_count INTEGER NOT NULL DEFAULT 0
        CHECK (attempt_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    idx_admission_code_verification_updated_at
ON public.admission_code_verification_attempts (updated_at);

COMMENT ON TABLE public.admission_code_verification_attempts
IS 'Stores hashed visitor identifiers and admission confirmation-code verification attempts for persistent rate limiting.';

COMMENT ON COLUMN public.admission_code_verification_attempts.client_key
IS 'SHA-256 hash of the visitor identifier. Raw IP addresses are not stored.';

COMMENT ON COLUMN public.admission_code_verification_attempts.attempt_count
IS 'Number of confirmation-code verification attempts in the current 15-minute window.';

COMMIT;