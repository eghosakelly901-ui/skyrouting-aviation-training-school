-- SKYROUTING PERSISTENT ADMIN LOGIN RATE LIMITING
-- Migration: 006_admin_login_rate_limits

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
    client_key CHAR(64) PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    failed_attempts INTEGER NOT NULL DEFAULT 0
        CHECK (failed_attempts >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    idx_admin_login_attempts_updated_at
ON public.admin_login_attempts (updated_at);

COMMENT ON TABLE public.admin_login_attempts
IS 'Stores hashed visitor identifiers and failed administrator login attempts for persistent rate limiting.';

COMMENT ON COLUMN public.admin_login_attempts.client_key
IS 'SHA-256 hash of the visitor identifier. Raw IP addresses are not stored.';

COMMENT ON COLUMN public.admin_login_attempts.failed_attempts
IS 'Number of unsuccessful administrator login attempts in the current rate-limit window.';

COMMIT;