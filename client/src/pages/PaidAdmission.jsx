
import './PaidAdmission.css'
import { useState } from 'react'
import { Link } from 'react-router'
import { API_BASE_URL } from '../api.js'
import PaidAdmissionApplicationForm from '../components/PaidAdmissionApplicationForm.jsx'

function PaidAdmission() {
  const [applicantName, setApplicantName] = useState('')
  const [email, setEmail] = useState('')
  const [payment, setPayment] = useState(null)
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [applicationAccessToken, setApplicationAccessToken] = useState('')
  const [isCompletingPayment, setIsCompletingPayment] = useState(false)

  async function handlePaymentInitialize(event) {
    event.preventDefault()

    setStatus('')
    setIsSubmitting(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admissions/payments/initialize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            applicantName,
            email,
          }),
        }
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to initialise payment.'
        )
      }

      setPayment(result.data)

      setStatus(
        'Your demonstration payment session has been created. No money has been collected.'
      )

    } catch (error) {
      setStatus(
        error.message || 'Unable to connect to the payment service.'
      )

    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDemoPaymentComplete() {
    if (
      !import.meta.env.DEV ||
      !payment?.reference ||
      applicationAccessToken
    ) {
      return
    }

    setStatus('')
    setIsCompletingPayment(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admissions/payments/demo/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reference: payment.reference,
          }),
        }
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to verify demonstration payment.'
        )
      }

      const accessToken = result?.data?.accessToken

      if (
        typeof accessToken !== 'string' ||
        !/^[A-Za-z0-9_-]{40,60}$/.test(accessToken)
      ) {
        throw new Error('The payment verification response is invalid.')
      }

      setApplicationAccessToken(accessToken)

      setPayment((previous) => ({
        ...previous,
        status: result.data.status,
      }))

      setStatus(
        'Demonstration payment verified. No money was collected. You may now complete your application.'
      )

    } catch (error) {
      setStatus(
        error.message || 'Unable to verify demonstration payment.'
      )

    } finally {
      setIsCompletingPayment(false)
    }
  }

  return (
    <div className="paid-admission-page">
      <header className="paid-admission-header">
        <Link to="/" className="paid-admission-brand">
          <span>SKYROUTING</span>
          <small>AVIATION TRAINING SCHOOL LTD/GTE</small>
        </Link>

        <Link to="/" className="back-home-link">
          Back to Website
        </Link>
      </header>

      <main className="paid-admission-main">

        {import.meta.env.DEV ? (
          <div className="demo-notice">
            DEMONSTRATION PORTAL - NO REAL PAYMENT
          </div>
        ) : (
          <div className="demo-notice">
            LIVE PAYMENT PROCESSING IS NOT YET ENABLED.
            PLEASE CONTACT THE ADMISSIONS TEAM.
          </div>
        )}

        <section className="paid-admission-intro">
          <p className="section-label">STUDENT ADMISSIONS</p>

          <h1>Begin Your Aviation Journey</h1>

          <p>
            Welcome to the official Skyrouting Aviation Training
            School student admission portal. Complete your
            application and take the next step towards your
            aviation career.
          </p>
        </section>

        <section className="admission-process">
          <h2>How to Apply</h2>

          <div className="application-steps">
            <article className="application-step">
              <span className="step-number">01</span>
              <h3>Applicant Details</h3>
              <p>
                Enter your name and email address to begin.
              </p>
            </article>

            <article className="application-step">
              <span className="step-number">02</span>
              <h3>Application Fee</h3>
              <p>
                Complete the ₦10,000 application fee process.
              </p>
            </article>

            <article className="application-step">
              <span className="step-number">03</span>
              <h3>Complete Your Form</h3>
              <p>
                Fill in your personal, educational and
                course information.
              </p>
            </article>

            <article className="application-step">
              <span className="step-number">04</span>
              <h3>Submit Application</h3>
              <p>
                Submit your completed form and receive
                your application reference.
              </p>
            </article>
          </div>
        </section>

        <section className="application-fee-card">
          <div>
            <p className="fee-label">APPLICATION FEE</p>
            <h2>₦10,000</h2>
            <p>
              One-time student application fee.
              This is separate from tuition fees.
            </p>
          </div>

          <div className="fee-information">
            <p>Currency: Nigerian Naira (NGN)</p>
            <p>
              Application access: One application per successful payment.
            </p>
          </div>
        </section>

        <section className="payment-start-card">
          <div className="payment-start-heading">
            <p className="section-label">APPLICATION REGISTRATION</p>
            <h2>Applicant Details</h2>
            <p>
  {import.meta.env.DEV
    ? 'Enter your details below to prepare your application payment.'
    : 'Online application registration is temporarily unavailable. Please contact the admissions team for assistance.'}
</p>
          </div>

         {!import.meta.env.DEV ? (
  <div className="payment-unavailable" role="status">
    <h3>Online Applications Temporarily Unavailable</h3>

    <p>
      Secure online payment processing is not yet available.
      Please contact our admissions team for assistance.
    </p>

    <a href="mailto:admission.sats@skyrouting.com">
      admission.sats@skyrouting.com
    </a>
  </div>
) : !payment ? (
            <form
              className="applicant-payment-form"
              onSubmit={handlePaymentInitialize}
            >
              <div className="payment-form-group">
                <label htmlFor="applicantName">
                  Applicant Full Name
                </label>

                <input
                  id="applicantName"
                  type="text"
                  value={applicantName}
                  onChange={(event) =>
                    setApplicantName(event.target.value)
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
                  maxLength={180}
                  required
                />
              </div>

              <div className="payment-form-group">
                <label htmlFor="applicantEmail">
                  Email Address
                </label>

                <input
                  id="applicantEmail"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter your email address"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>

              <button
                type="submit"
                className="payment-start-button"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Preparing Payment...'
                  : 'Continue to Application Payment'}
              </button>
            </form>
          ) : (
            <div className="payment-session">
              <h3>Payment Session Created</h3>

              <p>
                Your application payment session has been
                prepared successfully.
              </p>

              <p>
                <strong>Applicant:</strong> {applicantName}
              </p>

              <p>
                <strong>Email:</strong> {email}
              </p>

              <p>
                <strong>Amount:</strong> ₦
                {Number(payment.amountNaira).toLocaleString('en-NG')}
              </p>

              <p>
                <strong>Payment Reference:</strong>
              </p>

              <code>{payment.reference}</code>

              <p>
                <strong>Status:</strong> {payment.status}
              </p>


{import.meta.env.DEV && !applicationAccessToken && (
  <button
    type="button"
    className="payment-start-button"
    onClick={handleDemoPaymentComplete}
    disabled={isCompletingPayment}
  >
    {isCompletingPayment
      ? 'Verifying Demonstration Payment...'
      : 'Simulate Successful Payment (Development Only)'}
  </button>
)}


              {applicationAccessToken && (
                <p className="demo-payment-warning">
                  Demonstration payment verified. Your application
                  form is now available below. No money was collected.
                </p>
              )}
            </div>
          )}

          {status && (
            <p
              className="payment-form-status"
              role="status"
              aria-live="polite"
            >
              {status}
            </p>
          )}
        </section>

        {applicationAccessToken && (
          <PaidAdmissionApplicationForm
            accessToken={applicationAccessToken}
          />
        )}

        <section className="admission-help">
          <h2>Need Assistance?</h2>

          <p>
            Contact the Skyrouting admissions team if you
            require assistance with your application.
          </p>

          <a href="mailto:admission.sats@skyrouting.com">
            admission.sats@skyrouting.com
          </a>
        </section>

      </main>

      <footer className="paid-admission-footer">
        <p>
          Copyright &copy; {new Date().getFullYear()}
          {' '}Skyrouting Aviation Training School Ltd/GTE.
        </p>

        <p>TRAIN - PREPARE - TAKE OFF</p>
      </footer>
    </div>
  )
}

export default PaidAdmission
