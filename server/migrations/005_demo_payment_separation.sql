-- SKYROUTING DEMONSTRATION PAYMENT SEPARATION
-- Migration: 005_demo_payment_separation

BEGIN;

-- Identify demonstration bank-transfer records.
ALTER TABLE public.admission_payments
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- Document the purpose of the field.
COMMENT ON COLUMN public.admission_payments.is_demo
IS 'TRUE for simulated bank-transfer payments that must never be treated as real money received.';

COMMIT;