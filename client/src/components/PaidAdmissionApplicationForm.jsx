import { useState } from 'react'
import { API_BASE_URL } from '../api.js'

const initialFormData = {
  admissionIntake: '',
  surname: '',
  firstName: '',
  otherNames: '',
  gender: '',
  dateOfBirth: '',
  maritalStatus: '',
  nationality: 'Nigerian',
  stateOfOrigin: '',
  lga: '',
  placeOfBirth: '',
  mobileNumber: '',
  emailAddress: '',
  residentialAddress: '',
  height: '',
  weight: '',
  hasMedicalCondition: '',
  isSelfSponsored: '',
  hasAviationExperience: '',
  aviationExperienceDetails: '',
  kinFullName: '',
  kinRelationship: '',
  kinPhone: '',
  kinEmail: '',
  kinAddress: '',
  highestQualification: '',
  yearObtained: '',
  schoolInstitution: '',
  courseCertificate: '',
  selectedCourse: '',
  courseOption: '',
  accommodationPreference: '',
  accommodationRequest: '',
  tuitionPaymentMethod: '',
  tuitionPayerName: '',
  tuitionPaymentDate: '',
  tuitionAmountPaid: '',
  tuitionPaymentStatus: '',
  tuitionTransactionReference: '',
  tuitionReceiptNumber: '',
  tuitionAmountOutstanding: '',
  applicantDeclarationAccepted: false,
  parentSponsorNameSignature: '',
  parentSponsorPhone: '',
}

const courses = [
  ['flight-dispatch', 'Flight Dispatch'],
  ['cabin-crew', 'Cabin Crew'],
  ['aviation-management', 'Aviation Management'],
  ['helicopter-landing-officers', 'Helicopter Landing Officers'],
  ['quality-management', 'Quality Management'],
  ['safety-management-system', 'Safety Management System'],
  ['radio-telephony', 'Radio Telephony'],
  ['search-and-rescue', 'Search and Rescue'],
  ['dangerous-goods', 'Dangerous Goods'],
]

const flightDispatchOptions = [
  ['basic', 'Basic'],
  ['advance', 'Advanced'],
  ['recurrent', 'Recurrent'],
  ['refresher', 'Refresher'],
]

const cabinCrewOptions = [
  ['ab-initio', 'Ab-initio'],
  ['conversion', 'Conversion'],
  ['recurrent', 'Recurrent'],
  ['refresher', 'Refresher'],
]

function PaidAdmissionApplicationForm({ accessToken }) {
  const [formData, setFormData] = useState(initialFormData)
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [submittedApplication, setSubmittedApplication] = useState(null)

  function handleChange(event) {
  const { name, value, type, checked } = event.target

  const booleanFields = [
    'hasMedicalCondition',
    'isSelfSponsored',
    'hasAviationExperience',
  ]

  const nextValue =
    type === 'checkbox'
      ? checked
      : booleanFields.includes(name)
        ? value === 'true'
        : value

  setFormData((previous) => ({
    ...previous,
    [name]: nextValue,

    ...(name === 'selectedCourse'
      ? { courseOption: '' }
      : {}),

    ...(name === 'hasMedicalCondition' && !nextValue
      ? { medicalConditionDetails: '' }
      : {}),

    ...(name === 'isSelfSponsored' && !nextValue
      ? { sponsorshipDetails: '' }
      : {}),

    ...(name === 'hasAviationExperience' && !nextValue
      ? { aviationExperienceDetails: '' }
      : {}),
  }))
}

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0]

    if (!file) return

    setStatus('')
    setPhotoUploaded(false)

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setStatus('Please select a JPEG, PNG or WebP photograph.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatus('Your passport photograph must not exceed 5 MB.')
      event.target.value = ''
      return
    }

    const uploadData = new FormData()

    uploadData.append('photo', file)

    setIsUploadingPhoto(true)

    try {
      const response = await fetch(
  `${API_BASE_URL}/api/admissions/passport-photos/upload`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: uploadData,
  }
)

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Passport photograph upload failed.'
        )
      }

      setPhotoUploaded(true)
      setStatus('Passport photograph uploaded securely.')

    } catch (error) {
      setStatus(
        error.message || 'Unable to upload your passport photograph.'
      )

    } finally {
      setIsUploadingPhoto(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('')

    if (!photoUploaded) {
      setStatus('Please upload your passport photograph before submitting.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admissions/applications/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            accessToken,
          }),
        }
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        const validationErrors = Array.isArray(result.errors)
          ? result.errors.join(' ')
          : ''

        throw new Error(
          validationErrors ||
          result.message ||
          'Unable to submit your application.'
        )
      }

      sessionStorage.removeItem('skyroutingAdmissionAccessToken')

      setSubmittedApplication(result.data)
      setStatus(result.message)

    } catch (error) {
      setStatus(
        error.message || 'Unable to submit your application.'
      )

    } finally {
      setIsSubmitting(false)
    }
  }

  function renderInput(name, label, type = 'text', required = false, maxLength) {
    return (
      <div className="paid-form-group">
        <label htmlFor={name}>{label}{required ? ' *' : ''}</label>

        <input
          id={name}
          name={name}
          type={type}
          value={String(formData[name] ?? '')}
          onChange={handleChange}
          maxLength={maxLength}
          required={required}
        />
      </div>
    )
  }

  function renderTextarea(name, label, required = false) {
    return (
      <div className="paid-form-group paid-form-full">
        <label htmlFor={name}>{label}{required ? ' *' : ''}</label>

        <textarea
          id={name}
          name={name}
          rows="3"
          value={formData[name]}
          onChange={handleChange}
          required={required}
        />
      </div>
    )
  }

  function renderSelect(name, label, options, required = false) {
    return (
      <div className="paid-form-group">
        <label htmlFor={name}>{label}{required ? ' *' : ''}</label>

        <select
          id={name}
          name={name}
          value={formData[name]}
          onChange={handleChange}
          required={required}
        >
          <option value="">Select an option</option>

          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
    )
  }

  function renderYesNo(name, label) {
    return renderSelect(
      name,
      label,
      [
        ['false', 'No'],
        ['true', 'Yes'],
      ],
      true
    )
  }

  if (submittedApplication) {
    return (
      <section className="paid-application-success">
        <h2>Application Submitted Successfully</h2>

        <p>Your admission application has been received.</p>

        <p>
          <strong>Application Number:</strong>
          {' '}{submittedApplication.applicationNumber}
        </p>

        <p>
          <strong>Application Status:</strong>
          {' '}{submittedApplication.status}
        </p>

        <p>
          Please keep your application number for future reference.
        </p>
      </section>
    )
  }

  return (
    <section className="paid-application-form-card">
      <div className="paid-application-heading">
        <p className="section-label">STUDENT ADMISSION FORM</p>
        <h2>Complete Your Application</h2>

        <p>
          Complete all required sections carefully.
          Fields marked with an asterisk (*) are compulsory.
        </p>
      </div>

      <form onSubmit={handleSubmit}>

        <div className="paid-application-section">
          <h3>1. Applicant and Personal Information</h3>

          <div className="paid-form-grid">
            {renderInput('admissionIntake', 'Admission Intake', 'text', true, 100)}
            {renderInput('surname', 'Surname', 'text', true, 100)}
            {renderInput('firstName', 'First Name', 'text', true, 100)}
            {renderInput('otherNames', 'Other Names', 'text', false, 150)}

            {renderSelect('gender', 'Gender', [
              ['male', 'Male'],
              ['female', 'Female'],
            ], true)}

            {renderInput('dateOfBirth', 'Date of Birth', 'date', true)}

            {renderInput('maritalStatus', 'Marital Status', 'text', false, 40)}
            {renderInput('nationality', 'Nationality', 'text', true, 100)}
            {renderInput('stateOfOrigin', 'State of Origin', 'text', false, 100)}
            {renderInput('lga', 'Local Government Area', 'text', false, 120)}
            {renderInput('placeOfBirth', 'Place of Birth', 'text', false, 120)}
            {renderInput('mobileNumber', 'Mobile Number', 'tel', true, 30)}
            {renderInput('emailAddress', 'Email Address', 'email', true, 254)}

            {renderTextarea('residentialAddress', 'Residential Address', true)}

            {renderInput('height', 'Height', 'text', false, 30)}
            {renderInput('weight', 'Weight', 'text', false, 30)}
          </div>
        </div>

        <div className="paid-application-section">
          <h3>2. Medical Information</h3>

          <div className="paid-form-grid">
            {renderYesNo('hasMedicalCondition', 'Do you have any inherent medical condition?')}
          </div>

          {formData.hasMedicalCondition && (
            <div className="paid-form-grid">
              {renderTextarea(
                'medicalConditionDetails',
                'Please specify the medical condition',
                true
              )}
            </div>
          )}
        </div>

        <div className="paid-application-section">
          <h3>3. Sponsorship and Aviation Experience</h3>

          <div className="paid-form-grid">
            {renderYesNo('isSelfSponsored', 'Are you self-sponsored?')}

            {renderYesNo(
              'hasAviationExperience',
              'Do you have previous aviation experience?'
            )}
          </div>

          {formData.isSelfSponsored && (
            <div className="paid-form-grid">
              {renderTextarea(
                'sponsorshipDetails',
                'Please provide your sponsorship details',
                true
              )}
            </div>
          )}

          {formData.hasAviationExperience && (
            <div className="paid-form-grid">
              {renderTextarea(
                'aviationExperienceDetails',
                'Please provide details of your aviation experience',
                true
              )}
            </div>
          )}
        </div>

        <div className="paid-application-section">
          <h3>4. Passport Photograph</h3>

          <p>
            Upload a recent passport photograph.
            Accepted formats: JPEG, PNG and WebP. Maximum size: 5 MB.
          </p>

          <div className="paid-form-group">
            <label htmlFor="passportPhoto">Passport Photograph *</label>

            <input
              id="passportPhoto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              disabled={isUploadingPhoto}
              required={!photoUploaded}
            />
          </div>

          {photoUploaded && (
            <p className="paid-photo-success">
              Passport photograph uploaded successfully.
            </p>
          )}

          {isUploadingPhoto && (
            <p>Uploading passport photograph...</p>
          )}
        </div>

        <div className="paid-application-section">
          <h3>5. Next-of-Kin Information</h3>

          <div className="paid-form-grid">
            {renderInput('kinFullName', 'Full Name of Next of Kin', 'text', true, 180)}
            {renderInput('kinRelationship', 'Relationship', 'text', true, 80)}
            {renderInput('kinPhone', 'Next-of-Kin Phone Number', 'tel', true, 30)}
            {renderInput('kinEmail', 'Next-of-Kin Email', 'email', false, 254)}
            {renderTextarea('kinAddress', 'Next-of-Kin Address', true)}
          </div>
        </div>

        <div className="paid-application-section">
          <h3>6. Educational Background</h3>

          <div className="paid-form-grid">
            {renderInput('highestQualification', 'Highest Qualification', 'text', true, 150)}
            {renderInput('yearObtained', 'Year Obtained', 'number', false)}
            {renderInput('schoolInstitution', 'School or Institution', 'text', true, 200)}
            {renderInput('courseCertificate', 'Course or Certificate', 'text', false, 200)}
          </div>
        </div>

        <div className="paid-application-section">
          <h3>7. Course Selection and Accommodation</h3>

          <div className="paid-form-grid">
            {renderSelect('selectedCourse', 'Select Training Course', courses, true)}

            {(
              formData.selectedCourse === 'flight-dispatch' ||
              formData.selectedCourse === 'cabin-crew'
            ) && renderSelect(
              'courseOption',
              'Select Training Option',
              formData.selectedCourse === 'flight-dispatch'
                ? flightDispatchOptions
                : cabinCrewOptions,
              true
            )}

            {renderSelect('accommodationPreference', 'Accommodation Preference', [
              ['day-student', 'Day Student'],
              ['hostel', 'Hostel'],
            ], true)}

            {renderTextarea('accommodationRequest', 'Accommodation Request or Additional Information')}
          </div>
        </div>

        <div className="paid-application-section">
          <h3>8. Tuition Payment Information</h3>

          <p>
            This section concerns school tuition payments only.
            It is separate from the ₦10,000 application fee.
          </p>

          <div className="paid-form-grid">
            {renderSelect('tuitionPaymentMethod', 'Tuition Payment Method', [
              ['cash', 'Cash'],
              ['bank-transfer', 'Bank Transfer'],
              ['pos', 'POS'],
              ['online', 'Online'],
            ])}

            {renderInput('tuitionPayerName', 'Name of Tuition Payer', 'text', false, 180)}
            {renderInput('tuitionPaymentDate', 'Tuition Payment Date', 'date')}
            {renderInput('tuitionAmountPaid', 'Tuition Amount Paid (NGN)', 'number')}

            {renderSelect('tuitionPaymentStatus', 'Tuition Payment Status', [
              ['full', 'Full Payment'],
              ['part', 'Part Payment'],
            ])}

            {renderInput('tuitionTransactionReference', 'Transaction Reference', 'text', false, 120)}
            {renderInput('tuitionReceiptNumber', 'Tuition Receipt Number', 'text', false, 100)}
            {renderInput('tuitionAmountOutstanding', 'Tuition Amount Outstanding (NGN)', 'number')}
          </div>
        </div>

        <div className="paid-application-section">
          <h3>9. Parent or Sponsor Information</h3>

          <div className="paid-form-grid">
            {renderInput('parentSponsorNameSignature', 'Parent/Sponsor Name and Signature', 'text', false, 200)}
            {renderInput('parentSponsorPhone', 'Parent/Sponsor Phone Number', 'tel', false, 30)}
          </div>
        </div>

        <div className="paid-application-section paid-declaration">
          <h3>10. Applicant Declaration</h3>

          <p>
            I declare that the information supplied in this application
            is true and complete to the best of my knowledge. I understand
            that false or misleading information may affect my admission.
          </p>

          <label className="paid-declaration-label">
            <input
              type="checkbox"
              name="applicantDeclarationAccepted"
              checked={formData.applicantDeclarationAccepted}
              onChange={handleChange}
              required
            />

            I accept the applicant declaration.
          </label>
        </div>

        <button
          type="submit"
          className="payment-start-button"
          disabled={isSubmitting || isUploadingPhoto || !photoUploaded}
        >
          {isSubmitting ? 'Submitting Application...' : 'Submit Admission Application'}
        </button>

        {status && (
          <p
            className="payment-form-status"
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
        )}

      </form>
    </section>
  )
}

export default PaidAdmissionApplicationForm