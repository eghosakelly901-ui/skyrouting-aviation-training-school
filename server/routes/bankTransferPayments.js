
const express = require('express')
const {
  randomBytes,
  createHash,
} = require('node:crypto')

const pool = require('../db')

const router = express.Router()

const APPLICATION_FEE_KOBO = 1000000
const ACCESS_TOKEN_TTL_MINUTES = 60

const CODE_PATTERN = /^SKY-[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/i
function isDemoMode() {
  const mode = String(
    process.env.BANK_TRANSFER_MODE || ''
  ).trim().toLowerCase()

  const environment = String(
    process.env.NODE_ENV || ''
  ).trim().toLowerCase()

  if (mode !== 'demo') {
    return false
  }

  // Never expose demonstration bank details in production
  // unless an explicitly authorised demonstration service is enabled.
  if (environment === 'production') {
    return (
      process.env.ALLOW_DEMO_BANK_TRANSFERS === 'true' &&
      process.env.DEMO_SERVICE === 'skyrouting-boss-demo'
    )
  }

  return true
}

function getBankConfiguration() {
  const mode = String(
    process.env.BANK_TRANSFER_MODE || ''
  ).trim().toLowerCase()

  if (!['demo', 'live'].includes(mode)) {
    return null
  }

  if (mode === 'demo' && !isDemoMode()) {
    return null
  }

  const details = {
    bankName: String(process.env.BANK_NAME || '').trim(),
    accountName: String(process.env.BANK_ACCOUNT_NAME || '').trim(),
    accountNumber: String(
      process.env.BANK_ACCOUNT_NUMBER || ''
    ).trim(),
    instructions: String(
      process.env.BANK_TRANSFER_INSTRUCTIONS || ''
    ).trim(),
  }

  if (
    !details.bankName ||
    !details.accountName ||
    !details.accountNumber
  ) {
    return null
  }

  if (mode === 'live') {
    const containsDemoLabel =
      /\b(demo|test|placeholder|not real)\b/i.test(
        `${details.bankName} ${details.accountName}`
      )

    const invalidAccountNumber =
      !/^\d{8,20}$/.test(details.accountNumber) ||
      /^0+$/.test(details.accountNumber)

    if (containsDemoLabel || invalidAccountNumber) {
      return null
    }
  }

  return {
    ...details,
    isDemo: mode === 'demo',
  }
}

function generatePaymentReference() {
  return `SKY-BANK-${Date.now()}-${randomBytes(6)
    .toString('hex')
    .toUpperCase()}`
}
function hashValue(value) {
  return createHash('sha256')
    .update(value)
    .digest('hex')
}
// PERSISTENT POSTGRESQL CODE VERIFICATION LIMITING
const VERIFY_WINDOW_MS = 15 * 60 * 1000
const MAX_VERIFY_ATTEMPTS = 5

// Return a hashed visitor identifier. Never store raw IP addresses.

function getVerificationClientKey(req) {
  let identifier

  if (process.env.RENDER === 'true') {
    const isIP = require('node:net').isIP

    const cloudflareIp = req.get('CF-Connecting-IP')
    const forwardedFor = req.get('X-Forwarded-For')

    const cloudflareCandidate =
      typeof cloudflareIp === 'string'
        ? cloudflareIp.trim()
        : ''

    const forwardedCandidate =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : ''

    const candidate =
      isIP(cloudflareCandidate) !== 0
        ? cloudflareCandidate
        : forwardedCandidate

    if (!candidate || isIP(candidate) === 0) {
      return null
    }

    identifier = `render:${candidate.toLowerCase()}`
  } else {
    const socketIp = req.socket?.remoteAddress

    if (
      typeof socketIp !== 'string' ||
      require('node:net').isIP(socketIp) === 0
    ) {
      return null
    }

    identifier = `local:${socketIp.toLowerCase()}`
  }

  return hashValue(identifier)
}

// Atomically record and check attempts in PostgreSQL.
async function checkVerificationLimit(clientKey) {
  const client = await pool.connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    await client.query(
      `INSERT INTO public.admission_code_verification_attempts
        (client_key)
       VALUES ($1)
       ON CONFLICT (client_key) DO NOTHING`,
      [clientKey]
    )

    const result = await client.query(
      `SELECT
          attempt_count,
          (
            window_started_at <=
            NOW() - ($2::double precision * INTERVAL '1 millisecond')
          ) AS window_expired,
          GREATEST(
            1,
            CEIL(
              EXTRACT(
                EPOCH FROM (
                  window_started_at +
                  ($2::double precision * INTERVAL '1 millisecond')
                  - NOW()
                )
              )
            )
          )::integer AS retry_after_seconds
       FROM public.admission_code_verification_attempts
       WHERE client_key = $1
       FOR UPDATE`,
      [clientKey, VERIFY_WINDOW_MS]
    )

    if (result.rows.length !== 1) {
      throw new Error('Unable to retrieve verification attempt record.')
    }

    const attempt = result.rows[0]

    if (attempt.window_expired) {
      await client.query(
        `UPDATE public.admission_code_verification_attempts
         SET window_started_at = NOW(),
             attempt_count = 1,
             updated_at = NOW()
         WHERE client_key = $1`,
        [clientKey]
      )
    } else if (
      Number(attempt.attempt_count) >= MAX_VERIFY_ATTEMPTS
    ) {
      await client.query('COMMIT')
      transactionStarted = false

      return {
        allowed: false,
        retryAfterSeconds: Number(attempt.retry_after_seconds),
      }
    } else {
      await client.query(
        `UPDATE public.admission_code_verification_attempts
         SET attempt_count = attempt_count + 1,
             updated_at = NOW()
         WHERE client_key = $1`,
        [clientKey]
      )
    }

    await client.query('COMMIT')
    transactionStarted = false

    return {
      allowed: true,
      retryAfterSeconds: Math.ceil(VERIFY_WINDOW_MS / 1000),
    }
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => {})
    }

    throw error
  } finally {
    client.release()
  }
}

// Remove obsolete verification records periodically.
async function cleanupExpiredVerificationAttempts() {
  try {
    await pool.query(
      `DELETE FROM public.admission_code_verification_attempts
       WHERE window_started_at < NOW() - INTERVAL '1 day'`
    )
  } catch (error) {
    console.error(
      'Verification attempt cleanup error:',
      error.message
    )
  }
}

cleanupExpiredVerificationAttempts()

const verificationCleanupTimer = setInterval(
  cleanupExpiredVerificationAttempts,
  6 * 60 * 60 * 1000
)

verificationCleanupTimer.unref()
function isValidTransferDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date <= new Date()
  )
}

// 1. Return the school's configured bank details
router.get('/bank-details', (req, res) => {
  const configuration = getBankConfiguration()

  if (!configuration) {
    return res.status(503).json({
      message: 'Bank-transfer details are not currently available. Please contact the admissions team.',
    })
  }

  return res.json({
    available: true,
    data: {
      bankName: configuration.bankName,
      accountName: configuration.accountName,
      accountNumber: configuration.accountNumber,
      instructions: configuration.instructions,
      amountNaira: APPLICATION_FEE_KOBO / 100,
      currency: 'NGN',
      isDemo: configuration.isDemo,
      warning: configuration.isDemo
        ? 'DEMONSTRATION ONLY. These are sample bank details. Do not transfer real money.'
        : null,
    },
  })
})

// 2. Submit applicant and bank-transfer information
router.post('/submit', async (req, res) => {
  const configuration = getBankConfiguration()

  if (!configuration) {
    return res.status(503).json({
      message: 'Bank-transfer details are not currently available.',
    })
  }

  const body = req.body || {}

  const applicantName =
    typeof body.applicantName === 'string'
      ? body.applicantName.trim()
      : ''

  const email =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''

  const mobileNumber =
    typeof body.mobileNumber === 'string'
      ? body.mobileNumber.trim()
      : ''

  const senderName =
    typeof body.transferSenderName === 'string'
      ? body.transferSenderName.trim()
      : ''

  const transferReference =
    typeof body.transferReference === 'string'
      ? body.transferReference.trim()
      : ''

  const transferDate =
    typeof body.transferDate === 'string'
      ? body.transferDate.trim()
      : ''

  if (
    !applicantName ||
    applicantName.length > 180 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    mobileNumber.length < 7 ||
    mobileNumber.length > 30 ||
    !senderName ||
    senderName.length > 180 ||
    !transferReference ||
    transferReference.length > 120 ||
    !isValidTransferDate(transferDate)
  ) {
    return res.status(400).json({
      message: 'Please provide valid applicant and bank-transfer details.',
    })
  }

  const paymentReference = generatePaymentReference()

  try {
    const result = await pool.query(
      `INSERT INTO public.admission_payments (
          payment_reference,
          applicant_name,
          email,
          amount_kobo,
          currency,
          status,
          payment_provider,
          applicant_mobile_number,
          transfer_sender_name,
          transfer_reference,
          transfer_date,
          transfer_submitted_at,
          is_demo
       )
       VALUES (
          $1, $2, $3, $4, 'NGN', 'pending', 'bank_transfer',
          $5, $6, $7, $8, NOW(), $9
       )
       RETURNING
          id,
          payment_reference,
          amount_kobo,
          currency,
          status,
          is_demo,
          created_at`,
      [
        paymentReference,
        applicantName,
        email,
        APPLICATION_FEE_KOBO,
        mobileNumber,
        senderName,
        transferReference,
        transferDate,
        configuration.isDemo,
      ]
    )

    const payment = result.rows[0]

    const message = payment.is_demo
      ? 'DEMONSTRATION ONLY: Your sample bank-transfer submission has been recorded. No money has been collected.'
      : 'Your bank-transfer details have been submitted. Your payment is awaiting confirmation by the admissions team.'

    return res.status(201).json({
      message,
      data: {
        paymentId: payment.id,
        reference: payment.payment_reference,
        amountNaira: payment.amount_kobo / 100,
        currency: payment.currency,
        status: payment.status,
        isDemo: payment.is_demo,
        createdAt: payment.created_at,
      },
    })

  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'This bank-transfer reference has already been submitted. Please contact admissions if you believe this is an error.',
      })
    }

    console.error('Bank-transfer submission error:', error.message)

    return res.status(500).json({
      message: 'Unable to submit your bank-transfer details.',
    })
  }
})

// 3. Verify an administrator-issued confirmation code
router.post('/verify-code', async (req, res) => {
  const verificationClientKey = getVerificationClientKey(req)

  if (!verificationClientKey) {
    return res.status(503).json({
      message: 'Client IP could not be verified. Code verification is temporarily unavailable.',
    })
  }

  let verificationLimit

  try {
    verificationLimit = await checkVerificationLimit(
      verificationClientKey
    )
  } catch (error) {
    console.error(
      'Confirmation-code rate limiter error:',
      error.message
    )

    return res.status(503).json({
      message: 'Confirmation-code verification is temporarily unavailable. Please try again later.',
    })
  }

  if (!verificationLimit.allowed) {
    res.set(
      'Retry-After',
      String(verificationLimit.retryAfterSeconds)
    )

    return res.status(429).json({
      message: 'Too many code attempts. Please try again later.',
      retryAfterSeconds: verificationLimit.retryAfterSeconds,
    })
  }

  const code =
    typeof req.body?.code === 'string'
      ? req.body.code.trim().toUpperCase()
      : ''

  if (!CODE_PATTERN.test(code)) {
    return res.status(401).json({
      message: 'Invalid, expired, or already-used confirmation code.',
    })
  }

  let client

  try {
    const confirmationCodeHash = hashValue(code)

    client = await pool.connect()

    await client.query('BEGIN')

    const paymentResult = await client.query(
      `SELECT
          id,
          payment_reference,
          amount_kobo,
          currency,
          status,
          payment_provider,
          is_demo,
          confirmation_code_expires_at,
          confirmation_code_used_at,
          confirmation_code_revoked_at,
          access_used_at
       FROM public.admission_payments
       WHERE confirmation_code_hash = $1
       FOR UPDATE`,
      [confirmationCodeHash]
    )

    const payment = paymentResult.rows[0]

    if (
      !payment ||
      payment.payment_provider !== 'bank_transfer' ||
      payment.status !== 'success' ||
      Number(payment.amount_kobo) !== APPLICATION_FEE_KOBO ||
      payment.currency.trim() !== 'NGN' ||
      !payment.confirmation_code_expires_at ||
      new Date(payment.confirmation_code_expires_at) <= new Date() ||
      payment.confirmation_code_used_at ||
      payment.confirmation_code_revoked_at ||
      payment.access_used_at ||
      (payment.is_demo && !isDemoMode())
    ) {
      await client.query('ROLLBACK')

      return res.status(401).json({
        message: 'Invalid, expired, or already-used application confirmation code.',
      })
    }

    const accessToken = randomBytes(32).toString('base64url')
    const accessTokenHash = hashValue(accessToken)

    const updatedPayment = await client.query(
      `UPDATE public.admission_payments
       SET
          confirmation_code_used_at = NOW(),
          access_token_hash = $2,
          access_expires_at =
              NOW() + ($3 * INTERVAL '1 minute'),
          updated_at = NOW()
       WHERE id = $1
         AND confirmation_code_used_at IS NULL
         AND confirmation_code_revoked_at IS NULL
         AND access_used_at IS NULL
       RETURNING
          payment_reference,
          access_expires_at`,
      [
        payment.id,
        accessTokenHash,
        ACCESS_TOKEN_TTL_MINUTES,
      ]
    )

    if (updatedPayment.rows.length === 0) {
      await client.query('ROLLBACK')

      return res.status(401).json({
        message: 'Invalid, expired, or already-used application confirmation code.',
      })
    }

    await client.query(
      `INSERT INTO public.admission_payment_audit (
          payment_id,
          admin_id,
          action,
          details
       )
       VALUES ($1, NULL, 'code_redeemed', $2::jsonb)`,
      [
        payment.id,
        JSON.stringify({
          method: 'applicant_confirmation_code',
          isDemo: payment.is_demo,
        }),
      ]
    )

    await client.query(
      `DELETE FROM public.admission_code_verification_attempts
       WHERE client_key = $1`,
      [verificationClientKey]
    )

    await client.query('COMMIT')

    return res.status(200).json({
      message: payment.is_demo
        ? 'DEMONSTRATION ONLY: Confirmation code accepted. No money was collected.'
        : 'Confirmation code accepted. You may now complete your application.',
      data: {
        valid: true,
        reference: updatedPayment.rows[0].payment_reference,
        accessToken,
        expiresAt: updatedPayment.rows[0].access_expires_at,
        accessExpiresInMinutes: ACCESS_TOKEN_TTL_MINUTES,
        isDemo: payment.is_demo,
      },
    })

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {})
    }

    console.error('Confirmation-code verification error:', error.message)

    return res.status(500).json({
      message: 'Unable to verify your application confirmation code.',
    })

  } finally {
    if (client) {
      client.release()
    }
  }
})

module.exports = router
