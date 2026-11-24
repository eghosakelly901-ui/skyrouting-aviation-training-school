const express = require('express')
const {
  randomBytes,
  createHash,
} = require('node:crypto')

const pool = require('../db')

const router = express.Router()

const APPLICATION_FEE_KOBO = 1000000

const allowedCourses = [
  'flight-dispatch',
  'cabin-crew',
  'aviation-management',
  'helicopter-landing-officers',
  'quality-management',
  'safety-management-system',
  'radio-telephony',
  'search-and-rescue',
  'dangerous-goods',
]

const allowedAccommodation = [
  'day-student',
  'hostel',
]

const flightDispatchOptions = [
  'basic',
  'advance',
  'recurrent',
  'refresher',
]

const cabinCrewOptions = [
  'ab-initio',
  'conversion',
  'recurrent',
  'refresher',
]

const allowedTuitionMethods = [
  'cash',
  'bank-transfer',
  'pos',
  'online',
]

const allowedTuitionStatuses = [
  'full',
  'part',
]

function validDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}

function readText(body, field, maxLength, errors, required = false) {
  const value = body[field]

  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push(`${field} is required.`)
    }

    return null
  }

  if (typeof value !== 'string') {
    errors.push(`${field} must be text.`)
    return null
  }

  const cleaned = value.trim()

  if (!cleaned && required) {
    errors.push(`${field} is required.`)
    return null
  }

  if (cleaned.length > maxLength) {
    errors.push(`${field} exceeds the permitted length.`)
    return null
  }

  return cleaned || null
}

function readBoolean(body, field, errors) {
  if (typeof body[field] !== 'boolean') {
    errors.push(`${field} must be true or false.`)
    return null
  }

  return body[field]
}

function readOptionalAmount(body, field, errors) {
  const value = body[field]

  if (value === undefined || value === null || value === '') {
    return null
  }

  const text = String(value)

  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) {
    errors.push(`${field} must be a valid amount.`)
    return null
  }

  return Number(text)
}

function readOptionalDate(body, field, errors) {
  const value = body[field]

  if (value === undefined || value === null || value === '') {
    return null
  }

  if (!validDate(value)) {
    errors.push(`${field} must be a valid date in YYYY-MM-DD format.`)
    return null
  }

  return value
}

function generateApplicationNumber() {
  const year = new Date().getFullYear()
  const reference = randomBytes(5).toString('hex').toUpperCase()

  return `SKY-${year}-${reference}`
}

// Submit a completed admission application
router.post('/submit', async (req, res) => {
  const body = req.body || {}
  const errors = []

  const accessToken =
    typeof body.accessToken === 'string'
      ? body.accessToken.trim()
      : ''

  if (!/^[A-Za-z0-9_-]{40,60}$/.test(accessToken)) {
    return res.status(401).json({
      message: 'A valid application access token is required.',
    })
  }

  // 1. Read applicant information

  const application = {
    admissionIntake: readText(body, 'admissionIntake', 100, errors, true),

    surname: readText(body, 'surname', 100, errors, true),
    firstName: readText(body, 'firstName', 100, errors, true),
    otherNames: readText(body, 'otherNames', 150, errors),

    gender: readText(body, 'gender', 20, errors, true),
    dateOfBirth: readText(body, 'dateOfBirth', 10, errors, true),
    maritalStatus: readText(body, 'maritalStatus', 40, errors),
    nationality: readText(body, 'nationality', 100, errors, true),
    stateOfOrigin: readText(body, 'stateOfOrigin', 100, errors),
    lga: readText(body, 'lga', 120, errors),
    placeOfBirth: readText(body, 'placeOfBirth', 120, errors),

    mobileNumber: readText(body, 'mobileNumber', 30, errors, true),
    emailAddress: readText(body, 'emailAddress', 254, errors, true),
    residentialAddress: readText(body, 'residentialAddress', 2000, errors, true),

    height: readText(body, 'height', 30, errors),
    weight: readText(body, 'weight', 30, errors),

    hasMedicalCondition: readBoolean(body, 'hasMedicalCondition', errors),
    medicalConditionDetails: readText(body, 'medicalConditionDetails', 2000, errors),

    isSelfSponsored: readBoolean(body, 'isSelfSponsored', errors),
    sponsorshipDetails: readText(body, 'sponsorshipDetails', 2000, errors),

    hasAviationExperience: readBoolean(body, 'hasAviationExperience', errors),
    aviationExperienceDetails: readText(body, 'aviationExperienceDetails', 2000, errors),

    kinFullName: readText(body, 'kinFullName', 180, errors, true),
    kinRelationship: readText(body, 'kinRelationship', 80, errors, true),
    kinPhone: readText(body, 'kinPhone', 30, errors, true),
    kinEmail: readText(body, 'kinEmail', 254, errors),
    kinAddress: readText(body, 'kinAddress', 2000, errors, true),

    highestQualification: readText(body, 'highestQualification', 150, errors, true),
    yearObtained: body.yearObtained,
    schoolInstitution: readText(body, 'schoolInstitution', 200, errors, true),
    courseCertificate: readText(body, 'courseCertificate', 200, errors),

    selectedCourse: readText(body, 'selectedCourse', 80, errors, true),
    courseOption: readText(body, 'courseOption', 30, errors),

    accommodationPreference: readText(body, 'accommodationPreference', 20, errors, true),
    accommodationRequest: readText(body, 'accommodationRequest', 2000, errors),

    tuitionPaymentMethod: readText(body, 'tuitionPaymentMethod', 20, errors),
    tuitionPayerName: readText(body, 'tuitionPayerName', 180, errors),
    tuitionPaymentDate: readOptionalDate(body, 'tuitionPaymentDate', errors),
    tuitionAmountPaid: readOptionalAmount(body, 'tuitionAmountPaid', errors),
    tuitionPaymentStatus: readText(body, 'tuitionPaymentStatus', 10, errors),
    tuitionTransactionReference: readText(body, 'tuitionTransactionReference', 120, errors),
    tuitionReceiptNumber: readText(body, 'tuitionReceiptNumber', 100, errors),
    tuitionAmountOutstanding: readOptionalAmount(body, 'tuitionAmountOutstanding', errors),

    applicantDeclarationAccepted: body.applicantDeclarationAccepted === true,

    parentSponsorNameSignature: readText(body, 'parentSponsorNameSignature', 200, errors),
    parentSponsorPhone: readText(body, 'parentSponsorPhone', 30, errors),
  }

  // 2. Validate personal information

  if (!['male', 'female'].includes(application.gender)) {
    errors.push('Please select a valid gender.')
  }

  if (!validDate(application.dateOfBirth)) {
    errors.push('Please provide a valid date of birth.')
  } else if (
    new Date(`${application.dateOfBirth}T00:00:00.000Z`) > new Date()
  ) {
    errors.push('Date of birth cannot be in the future.')
  }

  if (
    application.emailAddress &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.emailAddress)
  ) {
    errors.push('Please provide a valid applicant email address.')
  }

  if (
    application.kinEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.kinEmail)
  ) {
    errors.push('Please provide a valid next-of-kin email address.')
  }

  // 3. Validate medical information

  if (
    application.hasMedicalCondition === true &&
    !application.medicalConditionDetails
  ) {
    errors.push('Please specify the medical condition you declared.')
  }

  if (application.hasMedicalCondition === false) {
    application.medicalConditionDetails = null
  }
// Validate sponsorship details
if (
  application.isSelfSponsored === true &&
  !application.sponsorshipDetails
) {
  errors.push('Please provide your sponsorship details.')
}
  // 4. Validate aviation experience

  if (
    application.hasAviationExperience === true &&
    !application.aviationExperienceDetails
  ) {
    errors.push('Please provide details of your aviation experience.')
  }

  // 6. Validate educational background

  let yearObtained = null

  if (
    application.yearObtained !== undefined &&
    application.yearObtained !== null &&
    application.yearObtained !== ''
  ) {
    yearObtained = Number(application.yearObtained)

    if (
      !Number.isInteger(yearObtained) ||
      yearObtained < 1900 ||
      yearObtained > new Date().getFullYear()
    ) {
      errors.push('Please provide a valid qualification year.')
    }
  }

  // 7. Validate course selection

  if (!allowedCourses.includes(application.selectedCourse)) {
    errors.push('Please select a valid training course.')
  }

  if (
    application.selectedCourse === 'flight-dispatch' &&
    !flightDispatchOptions.includes(application.courseOption)
  ) {
    errors.push('Please select a Flight Dispatch training option.')
  }

  if (
    application.selectedCourse === 'cabin-crew' &&
    !cabinCrewOptions.includes(application.courseOption)
  ) {
    errors.push('Please select a Cabin Crew training option.')
  }

  if (
    application.selectedCourse &&
    !['flight-dispatch', 'cabin-crew'].includes(application.selectedCourse)
  ) {
    application.courseOption = null
  }

  // 8. Validate accommodation

  if (!allowedAccommodation.includes(application.accommodationPreference)) {
    errors.push('Please select a valid accommodation preference.')
  }

  // 9. Validate other school payment information

  if (
    application.tuitionPaymentMethod &&
    !allowedTuitionMethods.includes(application.tuitionPaymentMethod)
  ) {
    errors.push('Invalid tuition payment method.')
  }

  if (
    application.tuitionPaymentStatus &&
    !allowedTuitionStatuses.includes(application.tuitionPaymentStatus)
  ) {
    errors.push('Invalid tuition payment status.')
  }

  // 10. Applicant declaration

  if (application.applicantDeclarationAccepted !== true) {
    errors.push('You must accept the applicant declaration before submitting.')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Please correct the application information.',
      errors,
    })
  }

  // 11. Verify payment and submit application in one transaction

  let client

  try {
    const accessTokenHash = createHash('sha256')
      .update(accessToken)
      .digest('hex')

    client = await pool.connect()

    await client.query('BEGIN')

    const paymentResult = await client.query(
      `SELECT
          id,
          amount_kobo,
          currency,
          status,
          payment_provider,
          passport_photo_path
       FROM public.admission_payments
       WHERE access_token_hash = $1
         AND status = 'success'
         AND amount_kobo = $2
         AND currency = 'NGN'
         AND access_expires_at > NOW()
         AND access_used_at IS NULL
       FOR UPDATE`,
      [accessTokenHash, APPLICATION_FEE_KOBO]
    )

    const payment = paymentResult.rows[0]
    if (!payment) {
      await client.query('ROLLBACK')

      return res.status(401).json({
        message: 'Payment access is invalid, expired, or already used.',
      })
    }

       // Confirm that this payment has an uploaded passport photograph.
    const expectedPhotoPath =
      `applications/${payment.id}/`

    if (
      typeof payment.passport_photo_path !== 'string' ||
      !payment.passport_photo_path.startsWith(expectedPhotoPath) ||
      !new RegExp(
        `^applications/${payment.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`,
        'i'
      ).test(payment.passport_photo_path)
    ) {
      await client.query('ROLLBACK')

      return res.status(400).json({
        message: 'Please upload your passport photograph before submitting.',
      })
    }

    const applicationNumber = generateApplicationNumber()

    const columns = [
      'application_number',
      'payment_id',
      'admission_intake',
      'surname',
      'first_name',
      'other_names',
      'gender',
      'date_of_birth',
      'marital_status',
      'nationality',
      'state_of_origin',
      'lga',
      'place_of_birth',
      'mobile_number',
      'email_address',
      'residential_address',
      'height',
      'weight',
      'has_medical_condition',
      'medical_condition_details',
      'is_self_sponsored',
      'sponsorship_details',
      'has_aviation_experience',
      'aviation_experience_details',
      'passport_photo_path',
      'kin_full_name',
      'kin_relationship',
      'kin_phone',
      'kin_email',
      'kin_address',
      'highest_qualification',
      'year_obtained',
      'school_institution',
      'course_certificate',
      'selected_course',
      'course_option',
      'accommodation_preference',
      'accommodation_request',
      'tuition_payment_method',
      'tuition_payer_name',
      'tuition_payment_date',
      'tuition_amount_paid',
      'tuition_payment_status',
      'tuition_transaction_reference',
      'tuition_receipt_number',
      'tuition_amount_outstanding',
      'applicant_declaration_accepted',
      'parent_sponsor_name_signature',
      'parent_sponsor_phone',
      'official_payment_verified',
    ]

    const values = [
      applicationNumber,
      payment.id,
      application.admissionIntake,
      application.surname,
      application.firstName,
      application.otherNames,
      application.gender,
      application.dateOfBirth,
      application.maritalStatus,
      application.nationality,
      application.stateOfOrigin,
      application.lga,
      application.placeOfBirth,
      application.mobileNumber,
      application.emailAddress,
      application.residentialAddress,
      application.height,
      application.weight,
      application.hasMedicalCondition,
      application.medicalConditionDetails,
      application.isSelfSponsored,
      application.sponsorshipDetails,
      application.hasAviationExperience,
      application.aviationExperienceDetails,
      payment.passport_photo_path,
      application.kinFullName,
      application.kinRelationship,
      application.kinPhone,
      application.kinEmail,
      application.kinAddress,
      application.highestQualification,
      yearObtained,
      application.schoolInstitution,
      application.courseCertificate,
      application.selectedCourse,
      application.courseOption,
      application.accommodationPreference,
      application.accommodationRequest,
      application.tuitionPaymentMethod,
      application.tuitionPayerName,
      application.tuitionPaymentDate,
      application.tuitionAmountPaid,
      application.tuitionPaymentStatus,
      application.tuitionTransactionReference,
      application.tuitionReceiptNumber,
      application.tuitionAmountOutstanding,
      true,
      application.parentSponsorNameSignature,
      application.parentSponsorPhone,
      payment.payment_provider === 'paystack',
    ]

    const placeholders = values.map((value, index) => `$${index + 1}`)

    const insertResult = await client.query(
      `INSERT INTO public.admission_applications
        (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id, application_number, application_date, created_at`,
      values
    )

    const submittedApplication = insertResult.rows[0]

    // Consume the access token only after the application is saved
    const tokenUpdate = await client.query(
      `UPDATE public.admission_payments
       SET
          access_used_at = NOW(),
          updated_at = NOW()
       WHERE id = $1
         AND access_used_at IS NULL
       RETURNING id`,
      [payment.id]
    )

    if (tokenUpdate.rows.length === 0) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'This application access token has already been used.',
      })
    }

    await client.query('COMMIT')

    return res.status(201).json({
      message: 'Your admission application has been submitted successfully.',
      data: {
        applicationId: submittedApplication.id,
        applicationNumber: submittedApplication.application_number,
        applicationDate: submittedApplication.application_date,
        status: 'pending',
      },
    })

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {})
    }

    console.error('Admission application submission error:', error.message)

    return res.status(500).json({
      message: 'Unable to submit your admission application.',
    })

  } finally {
    if (client) {
      client.release()
    }
  }
})

module.exports = router