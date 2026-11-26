
-- SKYROUTING BANK TRANSFER AND ACCESS CODE SYSTEM
-- Migration: 004_bank_transfer_confirmation_codes
-- Application fee: NGN 10,000

BEGIN;

-- 1. Add applicant and bank transfer information
ALTER TABLE public.admission_payments
    ADD COLUMN applicant_mobile_number VARCHAR(30),
    ADD COLUMN transfer_sender_name VARCHAR(180),
    ADD COLUMN transfer_reference VARCHAR(120),
    ADD COLUMN transfer_date DATE,
    ADD COLUMN transfer_submitted_at TIMESTAMPTZ;

-- 2. Add administrator payment approval information
ALTER TABLE public.admission_payments
    ADD COLUMN confirmed_by_admin_id BIGINT,
    ADD COLUMN confirmed_at TIMESTAMPTZ;

ALTER TABLE public.admission_payments
    ADD CONSTRAINT admission_payments_confirmed_admin_fk
    FOREIGN KEY (confirmed_by_admin_id)
    REFERENCES public.admin_users(id)
    ON DELETE RESTRICT;

-- 3. Add secure confirmation code information
-- Only the SHA-256 hash will be stored, never the plain code.
ALTER TABLE public.admission_payments
    ADD COLUMN confirmation_code_hash CHAR(64),
    ADD COLUMN confirmation_code_expires_at TIMESTAMPTZ,
    ADD COLUMN confirmation_code_used_at TIMESTAMPTZ,
    ADD COLUMN confirmation_code_revoked_at TIMESTAMPTZ;

-- 4. Allow direct bank transfers while preserving old providers
ALTER TABLE public.admission_payments
    DROP CONSTRAINT IF EXISTS admission_payments_payment_provider_check;

ALTER TABLE public.admission_payments
    ADD CONSTRAINT admission_payments_payment_provider_check
    CHECK (
        payment_provider IN ('demo', 'paystack', 'bank_transfer')
    );

-- 5. Require applicant and transfer details for bank transfers
ALTER TABLE public.admission_payments
    ADD CONSTRAINT admission_payments_bank_transfer_details_check
    CHECK (
        payment_provider <> 'bank_transfer'
        OR (
            LENGTH(BTRIM(COALESCE(applicant_mobile_number, ''))) >= 7
            AND LENGTH(BTRIM(COALESCE(transfer_sender_name, ''))) > 0
            AND LENGTH(BTRIM(COALESCE(transfer_reference, ''))) > 0
            AND transfer_date IS NOT NULL
            AND transfer_submitted_at IS NOT NULL
        )
    );

-- 6. Require administrator confirmation for successful bank transfers
ALTER TABLE public.admission_payments
    ADD CONSTRAINT admission_payments_bank_transfer_approval_check
    CHECK (
        payment_provider <> 'bank_transfer'
        OR status <> 'success'
        OR (
            confirmed_by_admin_id IS NOT NULL
            AND confirmed_at IS NOT NULL
            AND confirmation_code_hash IS NOT NULL
            AND confirmation_code_expires_at IS NOT NULL
        )
    );

-- 7. Ensure confirmation codes belong to confirmed payments
ALTER TABLE public.admission_payments
    ADD CONSTRAINT admission_payments_confirmation_code_check
    CHECK (
        confirmation_code_hash IS NULL
        OR (
            confirmed_by_admin_id IS NOT NULL
            AND confirmed_at IS NOT NULL
            AND confirmation_code_expires_at IS NOT NULL
        )
    );

-- 8. Prevent duplicate bank transfer references
CREATE UNIQUE INDEX admission_payments_transfer_reference_uidx
ON public.admission_payments(transfer_reference)
WHERE payment_provider = 'bank_transfer'
  AND transfer_reference IS NOT NULL;

-- 9. Prevent duplicate confirmation code hashes
CREATE UNIQUE INDEX admission_payments_confirmation_code_hash_uidx
ON public.admission_payments(confirmation_code_hash)
WHERE confirmation_code_hash IS NOT NULL;

-- 10. Make pending bank transfer payments easy to retrieve
CREATE INDEX admission_payments_bank_transfer_queue_idx
ON public.admission_payments(created_at DESC)
WHERE payment_provider = 'bank_transfer'
  AND status = 'pending';

-- 11. Keep an audit history of payment and code actions
CREATE TABLE public.admission_payment_audit (
    id BIGSERIAL PRIMARY KEY,

    payment_id BIGINT NOT NULL
        REFERENCES public.admission_payments(id)
        ON DELETE RESTRICT,

    admin_id BIGINT
        REFERENCES public.admin_users(id)
        ON DELETE RESTRICT,

    action VARCHAR(30) NOT NULL
        CHECK (
            action IN (
                'payment_confirmed',
                'code_regenerated',
                'code_revoked',
                'code_redeemed'
            )
        ),

    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admission_payment_audit_payment_idx
ON public.admission_payment_audit(payment_id, created_at DESC);

COMMIT;
