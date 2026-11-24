
const express = require('express')
const { createClient } = require('@supabase/supabase-js')
const pool = require('../db')
const { requireAdmin } = require('../auth')

const router = express.Router()

const BUCKET_NAME =
  process.env.SUPABASE_BUCKET_NAME || 'admission-passports'

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Supabase storage configuration is missing.')
  }

  return createClient(supabaseUrl, supabaseSecretKey)
}



router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.application_number,
        a.admission_intake,
        a.surname,
        a.first_name,
        a.other_names,
        a.mobile_number,
        a.email_address,
        a.selected_course,
        a.course_option,
        a.admission_decision,
        a.created_at,
        p.status AS payment_status,
        p.amount_kobo,
        p.currency,
        p.paystack_reference,
        p.paid_at
      FROM public.admission_applications AS a
      INNER JOIN public.admission_payments AS p
        ON p.id = a.payment_id
      ORDER BY a.created_at DESC, a.id DESC
    `)

    return res.json({
      applications: result.rows,
    })
  } catch (error) {
    console.error('Paid applications list error:', error.message)

    return res.status(500).json({
      message: 'Unable to retrieve paid applications.',
    })
  }
})



router.get('/:id', requireAdmin, async (req, res) => {
  const applicationId = Number(req.params.id)

  if (!Number.isSafeInteger(applicationId) || applicationId < 1) {
    return res.status(400).json({
      message: 'Please provide a valid application ID.',
    })
  }

  try {
    const result = await pool.query(
      `SELECT
        a.*,
        p.status AS payment_status,
        p.amount_kobo,
        p.currency,
        p.paystack_reference,
        p.paid_at
       FROM public.admission_applications AS a
       INNER JOIN public.admission_payments AS p
         ON p.id = a.payment_id
       WHERE a.id = $1`,
      [applicationId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Application not found.',
      })
    }

    const application = result.rows[0]
    delete application.passport_photo_path

    return res.json({
      application,
    })
  } catch (error) {
    console.error('Paid application details error:', error.message)

    return res.status(500).json({
      message: 'Unable to retrieve application details.',
    })
  }
})



router.get('/:id/passport-photo', requireAdmin, async (req, res) => {
  const applicationId = Number(req.params.id)

  if (!Number.isSafeInteger(applicationId) || applicationId < 1) {
    return res.status(400).json({
      message: 'Please provide a valid application ID.',
    })
  }

  try {
    const result = await pool.query(
      `SELECT passport_photo_path
       FROM public.admission_applications
       WHERE id = $1`,
      [applicationId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Application not found.',
      })
    }

    const photoPath = result.rows[0].passport_photo_path

    if (!photoPath) {
      return res.status(404).json({
        message: 'No passport photograph is available for this application.',
      })
    }

    const supabase = getSupabaseClient()

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(photoPath, 300)

    if (error) {
      throw error
    }

    return res.json({
      photoUrl: data.signedUrl,
      expiresIn: 300,
    })
  } catch (error) {
    console.error('Admin passport photo error:', error.message)

    return res.status(500).json({
      message: 'Unable to retrieve the passport photograph.',
    })
  }
})



router.patch('/:id/decision', requireAdmin, async (req, res) => {
  const applicationId = Number(req.params.id)
  const { decision } = req.body

  const allowedDecisions = new Set([
    'pending',
    'approved',
    'not-approved',
  ])

  if (!Number.isSafeInteger(applicationId) || applicationId < 1) {
    return res.status(400).json({
      message: 'Please provide a valid application ID.',
    })
  }

  if (!allowedDecisions.has(decision)) {
    return res.status(400).json({
      message: 'Please provide a valid admission decision.',
    })
  }

  try {
    const result = await pool.query(
      `UPDATE public.admission_applications
       SET admission_decision = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, application_number, admission_decision`,
      [decision, applicationId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Application not found.',
      })
    }

    return res.json({
      message: 'Admission decision updated successfully.',
      application: result.rows[0],
    })
  } catch (error) {
    console.error('Admission decision update error:', error.message)

    return res.status(500).json({
      message: 'Unable to update the admission decision.',
    })
  }
})

module.exports = router
