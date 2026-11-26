
const express = require('express')
const { randomBytes, createHash } = require('node:crypto')

const pool = require('../db')
const { requireAdmin } = require('../auth')

const router = express.Router()

const APPLICATION_FEE_KOBO = 1000000

const CODE_TTL_HOURS = Number(
  process.env.ADMISSION_CONFIRMATION_CODE_TTL_HOURS || 168
)

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

  if (environment === 'production') {
    return (
      process.env.ALLOW_DEMO_BANK_TRANSFERS === 'true' &&
      process.env.DEMO_SERVICE === 'skyrouting-boss-demo'
    )
  }

  return true
}

function isLiveBankTransferConfigured() {
  const mode = String(
    process.env.BANK_TRANSFER_MODE || ''
  ).trim().toLowerCase()

  const bankName = String(process.env.BANK_NAME || '').trim()
  const accountName = String(
    process.env.BANK_ACCOUNT_NAME || ''
  ).trim()
  const accountNumber = String(
    process.env.BANK_ACCOUNT_NUMBER || ''
  ).trim()

  if (mode !== 'live') {
    return false
  }

  if (
    !bankName ||
    !accountName ||
    !/^\d{8,20}$/.test(accountNumber) ||
    /^0+$/.test(accountNumber)
  ) {
    return false
  }

  if (
    /\b(demo|test|placeholder|not real)\b/i.test(
      `${bankName} ${accountName}`
    )
  ) {
    return false
  }

  return true
}

function generateConfirmationCode() {
  const characters = randomBytes(10)
    .toString('hex')
    .toUpperCase()

  const groups = characters.match(/.{5}/g)

  return `SKY-${groups.join('-')}`
}

function hashConfirmationCode(code) {
  return createHash('sha256')
    .update(code)
    .digest('hex')
}

function buildApplicantMessage(payment, code, expiresAt) {
  const formattedExpiry = new Date(expiresAt).toLocaleString(
    'en-NG',
    {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Africa/Lagos',
    }
  )

  if (payment.is_demo) {
    return `DEMODEMONSTRATION MESSAGE \u2014 NO REAL PAYMENT WAS COLLECTED.

Dear ${payment.applicant_name},

SKYROUTING AVIATION TRAINING SCHOOL

This is a demonstration of our application payment confirmation system. No actual money has been received or verified.

Your TEST Application Access Code is:

${code}

This is a test code for demonstrating the admission portal. It expires on ${formattedExpiry} (Nigeria time).

Please do not interpret this message as confirmation of a genuine payment.

Thank you.

Admissions Office
Skyrouting Aviation Training School`
  }

  return `Dear ${payment.applicant_name},

SKYROUTING AVIATION TRAINING SCHOOL

We are pleased to inform you that your application fee payment of \u20A610,000 has been confirmed successfully.

Your Application Access Code is:

${code}

Please visit our official admission portal, enter your access code and proceed to complete your application form.

Please note that this code is personal to you, can only be used once, and expires on ${formattedExpiry} (Nigeria time).

Thank you for choosing Skyrouting Aviation Training School.

Admissions Office
Skyrouting Aviation Training School`
}

// 1. List pending bank-transfer submissions
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          id,
          payment_reference,
          applicant_name,
          email,
          applicant_mobile_number,
          amount_kobo,
          currency,
          status,
          is_demo,
          transfer_sender_name,
          transfer_reference,
          transfer_date,
          transfer_submitted_at,
          created_at
       FROM public.admission_payments
       WHERE payment_provider = 'bank_transfer'
         AND status = 'pending'
       ORDER BY transfer_submitted_at ASC, id ASC
       LIMIT 200`
    )

    return res.json({
      payments: result.rows,
    })

  } catch (error) {
    console.error('Pending bank-transfer list error:', error.message)

    return res.status(500).json({
      message: 'Unable to retrieve pending bank-transfer payments.',
    })
  }
})

// 2. Confirm payment and generate the applicant's unique code
router.post('/:id/confirm', requireAdmin, async (req, res) => {
  const paymentId = Number(req.params.id)

  if (!Number.isSafeInteger(paymentId) || paymentId < 1) {
    return res.status(400).json({
      message: 'Please provide a valid payment ID.',
    })
  }

  if (!req.admin?.id) {
    return res.status(401).json({
      message: 'Administrator authentication is required.',
    })
  }

  if (
    !Number.isInteger(CODE_TTL_HOURS) ||
    CODE_TTL_HOURS < 1 ||
    CODE_TTL_HOURS > 720
  ) {
    console.error('Invalid confirmation-code expiry configuration.')

    return res.status(500).json({
      message: 'The confirmation-code configuration is invalid.',
    })
  }

  const confirmationCode = generateConfirmationCode()
  const confirmationCodeHash =
    hashConfirmationCode(confirmationCode)

  let client

  try {
    client = await pool.connect()

    await client.query('BEGIN')

    // Lock the payment row to prevent two administrators
    // from confirming the same payment simultaneously.
    const paymentResult = await client.query(
      `SELECT
          id,
          payment_reference,
          applicant_name,
          email,
          applicant_mobile_number,
          amount_kobo,
          currency,
          status,
          payment_provider,
          is_demo,
          transfer_sender_name,
          transfer_reference
       FROM public.admission_payments
       WHERE id = $1
       FOR UPDATE`,
      [paymentId]
    )

    const payment = paymentResult.rows[0]

    if (!payment) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        message: 'Payment record not found.',
      })
    }

    if (payment.payment_provider !== 'bank_transfer') {
      await client.query('ROLLBACK')

      return res.status(400).json({
        message: 'Only bank-transfer payments can be confirmed here.',
      })
    }

    if (payment.status !== 'pending') {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'This payment has already been processed.',
      })
    }

    if (
      Number(payment.amount_kobo) !== APPLICATION_FEE_KOBO ||
      payment.currency.trim() !== 'NGN' ||
      !payment.applicant_mobile_number ||
      !payment.transfer_sender_name ||
      !payment.transfer_reference
    ) {
      await client.query('ROLLBACK')

      return res.status(400).json({
        message: 'This payment record does not contain valid transfer details.',
      })
    }

    // Demonstration payments can only be approved while the
    // explicitly configured demonstration mode is active.
    if (payment.is_demo && !isDemoMode()) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'Demonstration approval is disabled in the current environment.',
      })
    }

    // Genuine payments can only be confirmed after official
    // bank details have replaced the temporary demonstration details.
    if (!payment.is_demo && !isLiveBankTransferConfigured()) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'Live bank-transfer confirmation is unavailable. Configure the official school bank details first.',
      })
    }

    const updatedResult = await client.query(
      `UPDATE public.admission_payments
       SET
          status = 'success',
          payment_channel = 'bank_transfer',
          paid_at = NOW(),
          confirmed_by_admin_id = $2,
          confirmed_at = NOW(),
          confirmation_code_hash = $3,
          confirmation_code_expires_at =
              NOW() + ($4 * INTERVAL '1 hour'),
          updated_at = NOW()
       WHERE id = $1
         AND status = 'pending'
       RETURNING
          payment_reference,
          paid_at,
          confirmation_code_expires_at,
          amount_kobo,
          currency`,
      [
        payment.id,
        req.admin.id,
        confirmationCodeHash,
        CODE_TTL_HOURS,
      ]
    )

    if (updatedResult.rows.length === 0) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'Unable to confirm this payment.',
      })
    }

    const confirmedPayment = updatedResult.rows[0]

    // Record the administrator's approval.
    // The plain confirmation code is never stored in this audit record.
    await client.query(
      `INSERT INTO public.admission_payment_audit (
          payment_id,
          admin_id,
          action,
          details
       )
       VALUES ($1, $2, 'payment_confirmed', $3::jsonb)`,
      [
        payment.id,
        req.admin.id,
        JSON.stringify({
          paymentReference: confirmedPayment.payment_reference,
          transferReference: payment.transfer_reference,
          amountKobo: confirmedPayment.amount_kobo,
          currency: confirmedPayment.currency,
          isDemo: payment.is_demo,
          codeExpiresAt: confirmedPayment.confirmation_code_expires_at,
        }),
      ]
    )

        const messageToApplicant = buildApplicantMessage(
      payment,
      confirmationCode,
      confirmedPayment.confirmation_code_expires_at
    )

    await client.query('COMMIT')

    return res.status(200).json({
      message: payment.is_demo
        ? 'DEMONSTRATION ONLY: Test approval completed. No real money was collected.'
        : 'Payment confirmed and application access code generated successfully.',
      data: {
        paymentReference: confirmedPayment.payment_reference,
        applicantName: payment.applicant_name,
        email: payment.email,
        mobileNumber: payment.applicant_mobile_number,
        amountNaira: confirmedPayment.amount_kobo / 100,
        isDemo: payment.is_demo,
        approvalLabel: payment.is_demo
          ? 'DEMO APPROVED \u2014 NO REAL MONEY RECEIVED'
          : 'PAYMENT CONFIRMED',
        confirmationCode,
        codeExpiresAt: confirmedPayment.confirmation_code_expires_at,
        messageToApplicant,
        confirmedBy: req.admin.email,
        confirmedAt: confirmedPayment.paid_at,
      },
    })

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {})
    }

    console.error('Bank-transfer confirmation error:', error.message)

    return res.status(500).json({
      message: 'Unable to confirm this payment and generate its access code.',
    })

  } finally {
    if (client) {
      client.release()
    }
  }
})

module.exports = router
