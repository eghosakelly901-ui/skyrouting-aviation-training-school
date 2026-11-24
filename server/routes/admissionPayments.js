const express = require('express')
const {
  randomBytes,
  createHash,
} = require('node:crypto')

const pool = require('../db')

const router = express.Router()

// Fixed application fee: ₦10,000
const APPLICATION_FEE_KOBO = 1000000

// Applicants have 60 minutes to use their access token
const ACCESS_TOKEN_TTL_MINUTES = 60

// Demonstration payments must be explicitly enabled
// Demonstration payments are permitted only in local development
function isDemoPaymentEnabled() {
  const isDevelopment =
    String(process.env.NODE_ENV || '')
      .trim()
      .toLowerCase() === 'development'

  const isDemoMode =
    String(process.env.PAYMENT_MODE || '')
      .trim()
      .toLowerCase() === 'demo'

  return isDevelopment && isDemoMode
}

// Generate a unique demonstration payment reference
function generatePaymentReference() {
  return `SKY-DEMO-${Date.now()}-${randomBytes(6).toString('hex').toUpperCase()}`
}

// 1. Initialise a demonstration payment
router.post('/initialize', async (req, res) => {
  if (!isDemoPaymentEnabled()) {
    return res.status(503).json({
      message: 'The payment system is not currently enabled.',
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

  if (
    !applicantName ||
    !email ||
    applicantName.length > 180 ||
    email.length > 254
  ) {
    return res.status(400).json({
      message: 'Please provide a valid applicant name and email.',
    })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      message: 'Please provide a valid email address.',
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
          payment_provider
       )
       VALUES ($1, $2, $3, $4, 'NGN', 'pending', 'demo')
       RETURNING
          id,
          payment_reference,
          amount_kobo,
          currency,
          status,
          payment_provider,
          created_at`,
      [
        paymentReference,
        applicantName,
        email,
        APPLICATION_FEE_KOBO,
      ]
    )

    const payment = result.rows[0]

    return res.status(201).json({
      message: 'Demonstration payment session created. No money has been collected.',
      data: {
        paymentId: payment.id,
        reference: payment.payment_reference,
        amountKobo: payment.amount_kobo,
        amountNaira: payment.amount_kobo / 100,
        currency: payment.currency,
        status: payment.status,
        provider: payment.payment_provider,
        createdAt: payment.created_at,
      },
    })

  } catch (error) {
    console.error('Payment initialisation error:', error.message)

    return res.status(500).json({
      message: 'Unable to initialise the demonstration payment.',
    })
  }
})

// 2. Simulate successful demonstration payment
router.post('/demo/complete', async (req, res) => {
  if (!isDemoPaymentEnabled()) {
    return res.status(403).json({
      message: 'Demonstration payments are disabled.',
    })
  }

  const reference =
    typeof req.body?.reference === 'string'
      ? req.body.reference.trim()
      : ''

  if (!reference || reference.length > 100) {
    return res.status(400).json({
      message: 'A valid payment reference is required.',
    })
  }

  let client

  try {
    client = await pool.connect()

    await client.query('BEGIN')

    const paymentResult = await client.query(
      `SELECT
          id,
          payment_reference,
          amount_kobo,
          currency,
          status,
          payment_provider
       FROM public.admission_payments
       WHERE payment_reference = $1
       FOR UPDATE`,
      [reference]
    )

    const payment = paymentResult.rows[0]

    if (!payment) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        message: 'Payment reference not found.',
      })
    }

    if (payment.payment_provider !== 'demo') {
      await client.query('ROLLBACK')

      return res.status(400).json({
        message: 'This payment does not belong to demonstration mode.',
      })
    }

    if (
      Number(payment.amount_kobo) !== APPLICATION_FEE_KOBO ||
      payment.currency.trim() !== 'NGN'
    ) {
      await client.query('ROLLBACK')

      return res.status(400).json({
        message: 'The application payment amount is invalid.',
      })
    }

    if (payment.status !== 'pending') {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'This payment has already been processed.',
      })
    }

    // Generate a secure token for one application
    const accessToken = randomBytes(32).toString('base64url')

    // Store only the SHA-256 hash in the database
    const accessTokenHash = createHash('sha256')
      .update(accessToken)
      .digest('hex')

    const updatedPayment = await client.query(
      `UPDATE public.admission_payments
       SET
          status = 'success',
          payment_channel = 'demo',
          access_token_hash = $2,
          access_expires_at =
              NOW() + ($3 * INTERVAL '1 minute'),
          paid_at = NOW(),
          updated_at = NOW()
       WHERE id = $1
         AND status = 'pending'
       RETURNING
          payment_reference,
          status,
          access_expires_at,
          amount_kobo,
          currency`,
      [
        payment.id,
        accessTokenHash,
        ACCESS_TOKEN_TTL_MINUTES,
      ]
    )

    if (updatedPayment.rows.length === 0) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'Unable to complete this payment.',
      })
    }

    await client.query('COMMIT')

    const completedPayment = updatedPayment.rows[0]

    return res.status(200).json({
      message: 'DEMONSTRATION ONLY: Payment simulated successfully. No money was collected.',
      data: {
        reference: completedPayment.payment_reference,
        status: completedPayment.status,
        amountNaira: completedPayment.amount_kobo / 100,
        currency: completedPayment.currency,
        provider: 'demo',
        accessToken,
        accessExpiresAt: completedPayment.access_expires_at,
        accessExpiresInMinutes: ACCESS_TOKEN_TTL_MINUTES,
      },
    })

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {})
    }

    console.error('Demo payment completion error:', error.message)

    return res.status(500).json({
      message: 'Unable to complete the demonstration payment.',
    })

  } finally {
    if (client) {
      client.release()
    }
  }
})

// 3. Verify admission application access token
router.post('/access/verify', async (req, res) => {
  const accessToken =
    typeof req.body?.accessToken === 'string'
      ? req.body.accessToken.trim()
      : ''

  if (!/^[A-Za-z0-9_-]{40,60}$/.test(accessToken)) {
    return res.status(401).json({
      message: 'Invalid, expired, or already-used application access token.',
    })
  }

  try {
    const accessTokenHash = createHash('sha256')
      .update(accessToken)
      .digest('hex')

    const result = await pool.query(
      `SELECT
          payment_reference,
          amount_kobo,
          currency,
          access_expires_at
       FROM public.admission_payments
       WHERE access_token_hash = $1
         AND status = 'success'
         AND amount_kobo = $2
         AND currency = 'NGN'
         AND access_expires_at > NOW()
         AND access_used_at IS NULL
       LIMIT 1`,
      [accessTokenHash, APPLICATION_FEE_KOBO]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Invalid, expired, or already-used application access token.',
      })
    }

    const payment = result.rows[0]

    return res.status(200).json({
      message: 'Application access verified successfully.',
      data: {
        valid: true,
        amountNaira: payment.amount_kobo / 100,
        currency: payment.currency,
        expiresAt: payment.access_expires_at,
      },
    })

  } catch (error) {
    console.error('Application access verification error:', error.message)

    return res.status(500).json({
      message: 'Unable to verify application access.',
    })
  }
})
module.exports = router