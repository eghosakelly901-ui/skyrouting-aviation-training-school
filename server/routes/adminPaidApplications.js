
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
        p.payment_reference AS paystack_reference,
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
        p.payment_reference AS paystack_reference,
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
    // Confirm that the application's photograph matches
    // the photograph stored against its original payment.
    const result = await pool.query(
      `SELECT
          a.passport_photo_path AS application_photo_path,
          p.passport_photo_path AS payment_photo_path,
          p.id AS payment_id
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

    const {
      application_photo_path: photoPath,
      payment_photo_path: paymentPhotoPath,
      payment_id: paymentId,
    } = result.rows[0]

    if (!photoPath || !paymentPhotoPath) {
      return res.status(404).json({
        message: 'No passport photograph is available for this application.',
      })
    }

    // Reject mismatched application and payment photo records.
    if (photoPath !== paymentPhotoPath) {
      console.error(
        'Passport photograph path mismatch for application:',
        applicationId
      )

      return res.status(409).json({
        message: 'The passport photograph record requires administrator review.',
      })
    }

    // Only allow the expected payment folder and UUID filename.
    const expectedPhotoPattern = new RegExp(
      `^applications/${paymentId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
      'i'
    )

    if (!expectedPhotoPattern.test(photoPath)) {
      console.error(
        'Invalid passport photograph storage path for application:',
        applicationId
      )

      return res.status(404).json({
        message: 'No valid passport photograph is available for this application.',
      })
    }

    const supabase = getSupabaseClient()

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(photoPath, 300)

    if (error) {
      throw error
    }

    if (!data?.signedUrl) {
      throw new Error('Supabase did not return a signed photograph URL.')
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
  const { decision } = req.body || {}

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

  let client
  let transactionStarted = false

  try {
    client = await pool.connect()

    await client.query('BEGIN')
    transactionStarted = true

    // Retrieve and lock the application while updating its decision.
    const existingResult = await client.query(
      `SELECT
          a.id,
          a.application_number,
          a.first_name,
          a.other_names,
          a.surname,
          a.email_address,
          a.mobile_number,
          a.selected_course,
          a.course_option,
          a.admission_decision,
          p.is_demo
       FROM public.admission_applications AS a
       INNER JOIN public.admission_payments AS p
         ON p.id = a.payment_id
       WHERE a.id = $1
       FOR UPDATE OF a`,
      [applicationId]
    )

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK')
      transactionStarted = false

      return res.status(404).json({
        message: 'Application not found.',
      })
    }

    const existing = existingResult.rows[0]

    const decisionChanged =
      existing.admission_decision !== decision

    let updatedApplication = {
      id: existing.id,
      application_number: existing.application_number,
      admission_decision: existing.admission_decision,
    }

    if (decisionChanged) {
      const updateResult = await client.query(
        `UPDATE public.admission_applications
         SET admission_decision = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, application_number, admission_decision`,
        [decision, applicationId]
      )

      updatedApplication = updateResult.rows[0]
    }

    await client.query('COMMIT')
    transactionStarted = false

    // Prepare a notification only when the decision actually changes.
    let notification = null

    if (
      decisionChanged &&
      (decision === 'approved' || decision === 'not-approved')
    ) {
      const applicantName = [
        existing.first_name,
        existing.other_names,
        existing.surname,
      ]
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim())
        .join(' ') || 'Applicant'

      const courseName = String(
        existing.selected_course ||
        existing.course_option ||
        'your selected training programme'
      )
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase())

      const isDemo = existing.is_demo === true

      let subject
      let message

      if (decision === 'approved') {
        subject = 'Admission Offer - Skyrouting Aviation Training School'

        message = `Dear ${applicantName},

Congratulations!

We are pleased to inform you that your application for admission into the ${courseName} programme at Skyrouting Aviation Training School Ltd/GTE has been approved.

Your application details are:

Application Number: ${existing.application_number}
Programme: ${courseName}
Admission Status: APPROVED

Please contact the Admissions Office for information concerning your admission acceptance, resumption arrangements and further registration requirements.

We congratulate you on this achievement and look forward to welcoming you to Skyrouting Aviation Training School.

Admissions Office
Skyrouting Aviation Training School Ltd/GTE`
      } else {
        subject = 'Admission Application Update - Skyrouting Aviation Training School'

        message = `Dear ${applicantName},

Thank you for applying to Skyrouting Aviation Training School Ltd/GTE.

After reviewing your application for the ${courseName} programme, we regret to inform you that your application has not been approved at this time.

Your application details are:

Application Number: ${existing.application_number}
Programme: ${courseName}
Admission Status: NOT APPROVED

For further clarification or enquiries, please contact the Admissions Office.

Thank you for your interest in Skyrouting Aviation Training School.

Admissions Office
Skyrouting Aviation Training School Ltd/GTE`
      }

      if (isDemo) {
        subject = `DEMONSTRATION ONLY - ${subject}`

        message =
          'DEMONSTRATION ONLY - THIS IS A TEST ADMISSION NOTICE. IT IS NOT A REAL ADMISSION DECISION.\n\n' +
          message
      }

      notification = {
        status: 'prepared',
        decision,
        isDemo,
        applicantName,
        applicationNumber: existing.application_number,
        courseName,
        email: existing.email_address,
        mobileNumber: existing.mobile_number,
        subject,
        message,
      }
    }

    return res.json({
      message: decisionChanged
        ? 'Admission decision updated successfully.'
        : 'Admission decision is unchanged. No new notification was prepared.',
      application: updatedApplication,
      decisionChanged,
      notification,
    })

  } catch (error) {
    if (client && transactionStarted) {
      await client.query('ROLLBACK').catch(() => {})
    }

    console.error('Admission decision update error:', error.message)

    return res.status(500).json({
      message: 'Unable to update the admission decision.',
    })
  } finally {
    if (client) {
      client.release()
    }
  }
})
module.exports = router
