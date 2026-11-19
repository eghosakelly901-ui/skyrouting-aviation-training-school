import './ApplicationForm.css'
import { useState } from 'react'
import courses from '../data/courses.js'
import { API_BASE_URL } from '../api.js'

function ApplicationForm() {
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setStatus('')
    setIsSubmitting(true)

    const form = event.currentTarget
    const formData = new FormData(form)
    const enquiry = Object.fromEntries(formData.entries())

    try {
      const response = await fetch(
  `${API_BASE_URL}/api/enquiries`,
  {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(enquiry),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Unable to submit enquiry.')
      }

      setStatus(
        `${result.message} Your reference number is ${result.data.id}.`
      )

      setStatusType('success')
      form.reset()

    } catch (error) {
      setStatus(error.message || 'Something went wrong. Please try again.')
      setStatusType('error')

    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="application-section" id="application">
      <div className="application-heading">
        <p className="section-label">STUDENT ENQUIRIES</p>

        <h2>Make an Admission Enquiry</h2>

        <p>
          Interested in our aviation training programmes?
          Complete the form below and let us know which course
          you would like to enquire about.
        </p>
      </div>

      <form className="application-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Enter your full name"
            autoComplete="name"
            maxLength={120}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            maxLength={254}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Telephone Number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Enter your telephone number"
            autoComplete="tel"
            maxLength={30}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="course">Course of Interest</label>

          <select
            id="course"
            name="course"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select a course
            </option>

            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="message">Your Enquiry</label>

          <textarea
            id="message"
            name="message"
            rows="5"
            maxLength={5000}
            placeholder="Write your enquiry here"
            required
          />
        </div>

        <button
          type="submit"
          className="application-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Enquiry'}
        </button>

        {status && (
          <p
            className={`form-status ${statusType}`}
            role={statusType === 'error' ? 'alert' : 'status'}
          >
            {status}
          </p>
        )}
      </form>
    </section>
  )
}

export default ApplicationForm