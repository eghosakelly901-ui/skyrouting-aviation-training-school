
-- SKYROUTING PAID ADMISSION PORTAL
-- Migration: 001_paid_admissions
-- Application fee: NGN 10,000 = 1,000,000 kobo

CREATE TABLE IF NOT EXISTS public.admission_payments (
    id BIGSERIAL PRIMARY KEY,

    paystack_reference VARCHAR(100) NOT NULL UNIQUE,
    applicant_name VARCHAR(180) NOT NULL,
    email VARCHAR(254) NOT NULL,

    amount_kobo INTEGER NOT NULL DEFAULT 1000000
        CHECK (amount_kobo = 1000000),

    currency CHAR(3) NOT NULL DEFAULT 'NGN'
        CHECK (currency = 'NGN'),

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'reversed')),

    paystack_transaction_id VARCHAR(40) UNIQUE,
    paystack_channel VARCHAR(40),
    paystack_receipt_number VARCHAR(100),

    authorization_url TEXT,

    access_token_hash CHAR(64) UNIQUE,
    access_expires_at TIMESTAMPTZ,
    access_used_at TIMESTAMPTZ,

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admission_payments_email_idx
ON public.admission_payments(email);

CREATE INDEX IF NOT EXISTS admission_payments_status_idx
ON public.admission_payments(status);


CREATE TABLE IF NOT EXISTS public.admission_applications (
    id BIGSERIAL PRIMARY KEY,

    application_number VARCHAR(40) NOT NULL UNIQUE,

    payment_id BIGINT NOT NULL UNIQUE
        REFERENCES public.admission_payments(id)
        ON DELETE RESTRICT,

    admission_intake VARCHAR(100) NOT NULL,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- 1. Personal information
    surname VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    other_names VARCHAR(150),

    gender VARCHAR(20) NOT NULL
        CHECK (gender IN ('male', 'female')),

    date_of_birth DATE NOT NULL,
    marital_status VARCHAR(40),
    nationality VARCHAR(100) NOT NULL,
    state_of_origin VARCHAR(100),
    lga VARCHAR(120),
    place_of_birth VARCHAR(120),

    mobile_number VARCHAR(30) NOT NULL,
    email_address VARCHAR(254) NOT NULL,
    residential_address TEXT NOT NULL,

    -- 2. Personal data
    height VARCHAR(30),
    weight VARCHAR(30),

    has_medical_condition BOOLEAN NOT NULL,
medical_condition_details TEXT,

CHECK (
    (
        has_medical_condition = TRUE
        AND LENGTH(BTRIM(COALESCE(medical_condition_details, ''))) > 0
    )
    OR
    (
        has_medical_condition = FALSE
        AND LENGTH(BTRIM(COALESCE(medical_condition_details, ''))) = 0
    )
),

    -- 3. Sponsorship and aviation experience
    is_self_sponsored BOOLEAN NOT NULL,
    sponsorship_details TEXT,

    has_aviation_experience BOOLEAN NOT NULL,
    aviation_experience_details TEXT,

    -- Passport photograph stored in external file storage
    passport_photo_url TEXT NOT NULL,

    -- 4. Next of kin
    kin_full_name VARCHAR(180) NOT NULL,
    kin_relationship VARCHAR(80) NOT NULL,
    kin_phone VARCHAR(30) NOT NULL,
    kin_email VARCHAR(254),
    kin_address TEXT NOT NULL,

    -- 5. Educational background
    highest_qualification VARCHAR(150) NOT NULL,
    year_obtained INTEGER,
    school_institution VARCHAR(200) NOT NULL,
    course_certificate VARCHAR(200),

    -- 6. Course selection
    selected_course VARCHAR(80) NOT NULL
        CHECK (selected_course IN (
            'flight-dispatch',
            'cabin-crew',
            'aviation-management',
            'helicopter-landing-officers',
            'quality-management',
            'safety-management-system',
            'radio-telephony',
            'search-and-rescue',
            'dangerous-goods'
        )),

    course_option VARCHAR(30),

    CHECK (
        (
            selected_course = 'flight-dispatch'
            AND course_option IS NOT NULL
            AND course_option IN (
                'basic', 'advance', 'recurrent', 'refresher'
            )
        )
        OR
        (
            selected_course = 'cabin-crew'
            AND course_option IS NOT NULL
            AND course_option IN (
                'ab-initio', 'conversion', 'recurrent', 'refresher'
            )
        )
        OR
        (
            selected_course NOT IN (
                'flight-dispatch', 'cabin-crew'
            )
            AND course_option IS NULL
        )
    ),

    -- 7. Accommodation
    accommodation_preference VARCHAR(20) NOT NULL
        CHECK (
            accommodation_preference IN (
                'day-student', 'hostel'
            )
        ),

    accommodation_request TEXT,

        -- 8. Other school payment information
    tuition_payment_method VARCHAR(20)
        CHECK (tuition_payment_method IN ('cash', 'bank-transfer', 'pos', 'online')),
    tuition_payer_name VARCHAR(180),
    tuition_payment_date DATE,
    tuition_amount_paid NUMERIC(12,2) CHECK (tuition_amount_paid >= 0),
    tuition_payment_status VARCHAR(10)
        CHECK (tuition_payment_status IN ('full', 'part')),
    tuition_transaction_reference VARCHAR(120),
    tuition_receipt_number VARCHAR(100),
    tuition_amount_outstanding NUMERIC(12,2)
        CHECK (tuition_amount_outstanding >= 0),
-- 9. Applicant declaration
    applicant_declaration_accepted BOOLEAN NOT NULL
        DEFAULT FALSE
        CHECK (applicant_declaration_accepted = TRUE),

    declaration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    parent_sponsor_name_signature VARCHAR(200),
    parent_sponsor_phone VARCHAR(30),

    -- 10. Official use only
    official_application_form_received BOOLEAN NOT NULL DEFAULT TRUE,
    official_payment_verified BOOLEAN NOT NULL DEFAULT FALSE,
    official_passport_photo_received BOOLEAN NOT NULL DEFAULT FALSE,
    official_academic_documents_received BOOLEAN NOT NULL DEFAULT FALSE,

    admission_decision VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            admission_decision IN (
                'pending', 'approved', 'not-approved'
            )
        ),

    student_id VARCHAR(80) UNIQUE,
    course_class_assigned VARCHAR(150),
    registration_date DATE,

    authorised_officer VARCHAR(180),
    authorised_officer_signature TEXT,
    authorised_officer_date DATE,
    official_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admission_applications_course_idx
ON public.admission_applications(selected_course);

CREATE INDEX IF NOT EXISTS admission_applications_decision_idx
ON public.admission_applications(admission_decision);

CREATE INDEX IF NOT EXISTS admission_applications_date_idx
ON public.admission_applications(created_at DESC);
