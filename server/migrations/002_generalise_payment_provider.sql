-- SKYROUTING PAYMENT PROVIDER CONFIGURATION
-- Migration: 002_generalise_payment_provider

ALTER TABLE public.admission_payments
    RENAME COLUMN paystack_reference TO payment_reference;

ALTER TABLE public.admission_payments
    RENAME COLUMN paystack_transaction_id TO provider_transaction_id;

ALTER TABLE public.admission_payments
    RENAME COLUMN paystack_channel TO payment_channel;

ALTER TABLE public.admission_payments
    RENAME COLUMN paystack_receipt_number TO payment_receipt_number;

ALTER TABLE public.admission_payments
    RENAME COLUMN authorization_url TO checkout_url;

ALTER TABLE public.admission_payments
    ADD COLUMN payment_provider VARCHAR(20)
    NOT NULL DEFAULT 'demo'
    CHECK (payment_provider IN ('demo', 'paystack'));