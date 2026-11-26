
import './PaidAdmission.css'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { API_BASE_URL } from '../api.js'
import PaidAdmissionApplicationForm from '../components/PaidAdmissionApplicationForm.jsx'

function PaidAdmission() {
  const [applicantName, setApplicantName] = useState('')
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')

  const [transferSenderName, setTransferSenderName] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [transferDate, setTransferDate] = useState('')

  const [bankDetails, setBankDetails] = useState(null)
  const [bankDetailsLoading, setBankDetailsLoading] = useState(true)
  const [bankDetailsError, setBankDetailsError] = useState('')

  const [payment, setPayment] = useState(null)
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [confirmationCode, setConfirmationCode] = useState('')
  const [codeStatus, setCodeStatus] = useState('')
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)

  const [applicationAccessToken, setApplicationAccessToken] = useState('')

  // Retrieve the configured school bank details.
  useEffect(() => {
    let active = true

    fetch(`${API_BASE_URL}/api/admissions/bank-transfer/bank-details`)
      .then(async (response) => {
        const result = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            result.message || 'Unable to retrieve bank details.'
          )
        }

        return result.data
      })
      .then((details) => {
        if (active) {
          setBankDetails(details)
        }
      })
      .catch((error) => {
        if (active) {
          setBankDetailsError(
            error.message || 'Unable to retrieve bank details.'
          )
        }
      })
      .finally(() => {
        if (active) {
          setBankDetailsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  // Submit applicant and bank-transfer information.
  async function handlePaymentInitialize(event) {
    event.preventDefault()

    setStatus('')
    setIsSubmitting(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admissions/bank-transfer/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            applicantName,
            email,
            mobileNumber,
            transferSenderName,
            transferReference,
            transferDate,
          }),
        }
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to submit bank-transfer details.'
        )
      }

      setPayment(result.data)
      setStatus(result.message)

    } catch (error) {
      setStatus(
        error.message || 'Unable to submit your bank-transfer details.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Verify the confirmation code sent by the admissions team.
  async function handleCodeVerification(event) {
    event.preventDefault()

    setCodeStatus('')
    setIsVerifyingCode(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admissions/bank-transfer/verify-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: confirmationCode.trim().toUpperCase(),
          }),
        }
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to verify your confirmation code.'
        )
      }

      const accessToken = result?.data?.accessToken

      if (
        typeof accessToken !== 'string' ||
        !/^[A-Za-z0-9_-]{40,60}$/.test(accessToken)
      ) {
        throw new Error('The application access response is invalid.')
      }

      setApplicationAccessToken(accessToken)
      setCodeStatus(result.message)

    } catch (error) {
      setCodeStatus(
        error.message || 'Unable to verify your confirmation code.'
      )
    } finally {
      setIsVerifyingCode(false)
    }
  }

  return (
    <div className="paid-admission-page">
      <header className="paid-admission-header">
        <Link to="/" className="paid-admission-brand">
          <img
            src="/images/skyrouting-logo.webp"
            alt="Skyrouting Aviation Training School Ltd/GTE"
            className="paid-admission-logo"
          />
        </Link>

        <Link to="/" className="back-home-link">
          Back to Website
        </Link>
      </header>

      <main className="paid-admission-main">

        <div className="demo-notice">
          {bankDetailsLoading
            ? 'LOADING BANK DETAILS'
            : bankDetails?.isDemo
              ? 'DEMONSTRATION PORTAL - NO REAL PAYMENT'
              : 'SKYROUTING APPLICATION BANK TRANSFER PORTAL'}
        </div>

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
              <p>Enter your name, email address and WhatsApp number.</p>
            </article>

            <article className="application-step">
              <span className="step-number">02</span>
              <h3>Bank Transfer</h3>
              <p>Transfer the ₦10,000 application fee.</p>
            </article>

            <article className="application-step">
              <span className="step-number">03</span>
              <h3>Payment Confirmation</h3>
              <p>Submit your transfer details and await confirmation.</p>
            </article>

            <article className="application-step">
              <span className="step-number">04</span>
              <h3>Complete Your Form</h3>
              <p>Enter your confirmation code and complete your application.</p>
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
            <p>Application access: One application per successful payment.</p>
          </div>
        </section>

        <section className="payment-start-card">
          <div className="payment-start-heading">
            <p className="section-label">BANK TRANSFER INFORMATION</p>
            <h2>Application Fee Bank Details</h2>
          </div>

          {bankDetailsLoading ? (
            <p>Loading bank details...</p>
          ) : bankDetailsError ? (
            <div className="payment-unavailable" role="alert">
              <h3>Bank Details Unavailable</h3>
              <p>{bankDetailsError}</p>
              <p>Please contact the admissions team for assistance.</p>
            </div>
          ) : bankDetails ? (
            <div className="bank-transfer-details">
              {bankDetails.isDemo && (
                <div className="payment-demo-warning">
                  DEMONSTRATION ONLY — THESE ARE SAMPLE BANK DETAILS.
                  DO NOT TRANSFER REAL MONEY.
                </div>
              )}

              <p><strong>Bank Name:</strong> {bankDetails.bankName}</p>
              <p><strong>Account Name:</strong> {bankDetails.accountName}</p>
              <p>
                <strong>Account Number:</strong> {bankDetails.accountNumber}
              </p>
              <p>
                <strong>Amount:</strong>{' '}
                ₦{Number(bankDetails.amountNaira).toLocaleString('en-NG')}
              </p>

              {bankDetails.instructions && (
                <p><strong>Instructions:</strong> {bankDetails.instructions}</p>
              )}
            </div>
          ) : null}
        </section>

        <section className="payment-start-card">
          <div className="payment-start-heading">
            <p className="section-label">APPLICATION REGISTRATION</p>
            <h2>Submit Your Transfer Details</h2>
            <p>
              Enter your personal information and the details
              of your bank transfer.
            </p>
          </div>

          {!payment ? (
            <form
              className="applicant-payment-form"
              onSubmit={handlePaymentInitialize}
            >
              <div className="payment-form-group">
                <label htmlFor="applicantName">Applicant Full Name</label>
                <input
                  id="applicantName"
                  type="text"
                  value={applicantName}
                  onChange={(event) => setApplicantName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  maxLength={180}
                  required
                />
              </div>

              <div className="payment-form-group">
                <label htmlFor="applicantEmail">Email Address</label>
                <input
                  id="applicantEmail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>

              <div className="payment-form-group">
                <label htmlFor="applicantMobile">WhatsApp / Mobile Number</label>
                <input
                  id="applicantMobile"
                  type="tel"
                  value={mobileNumber}
                  onChange={(event) => setMobileNumber(event.target.value)}
                  placeholder="Enter your WhatsApp number"
                  autoComplete="tel"
                  maxLength={30}
                  required
                />
              </div>

              <div className="payment-form-group">
                <label htmlFor="transferSenderName">Name on Bank Transfer</label>
                <input
                  id="transferSenderName"
                  type="text"
                  value={transferSenderName}
                  onChange={(event) => setTransferSenderName(event.target.value)}
                  placeholder="Name used when making the transfer"
                  maxLength={180}
                  required
                />
              </div>

              <div className="payment-form-group">
                <label htmlFor="transferReference">Bank Transfer Reference</label>
                <input
                  id="transferReference"
                  type="text"
                  value={transferReference}
                  onChange={(event) => setTransferReference(event.target.value)}
                  placeholder="Enter your bank transaction reference"
                  maxLength={120}
                  required
                />
              </div>

              <div className="payment-form-group">
                <label htmlFor="transferDate">Date of Transfer</label>
                <input
                  id="transferDate"
                  type="date"
                  value={transferDate}
                  max={new Date().toLocaleDateString('en-CA', {
                    timeZone: 'Africa/Lagos',
                  })}
                  onChange={(event) => setTransferDate(event.target.value)}
                  required
                />
              </div>

              {bankDetails?.isDemo && (
                <p className="payment-demo-warning">
                  TEST SUBMISSION ONLY. No real bank transfer should be made.
                </p>
              )}

              <button
                type="submit"
                className="payment-start-button"
                disabled={
                  isSubmitting ||
                  bankDetailsLoading ||
                  Boolean(bankDetailsError) ||
                  !bankDetails
                }
              >
                {isSubmitting
                  ? 'Submitting Transfer Details...'
                  : 'Submit Bank Transfer Details'}
              </button>
            </form>
          ) : (
            <div className="payment-session">
              <h3>Transfer Details Submitted</h3>
              <p>Your details have been received successfully.</p>
              <p><strong>Applicant:</strong> {applicantName}</p>
              <p><strong>Email:</strong> {email}</p>
              <p><strong>WhatsApp:</strong> {mobileNumber}</p>
              <p>
                <strong>Amount:</strong>{' '}
                ₦{Number(payment.amountNaira).toLocaleString('en-NG')}
              </p>
              <p><strong>Payment Reference:</strong></p>
              <code>{payment.reference}</code>
              <p><strong>Status:</strong> {payment.status}</p>

              {payment.isDemo && (
                <p className="payment-demo-warning">
                  DEMONSTRATION ONLY. No actual money has been collected.
                </p>
              )}

              <p>
                Your submission is awaiting the admissions team's
                confirmation. Once approved, the school will send
                your unique application access code.
              </p>
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

        {!applicationAccessToken && (
          <section className="payment-start-card">
            <div className="payment-start-heading">
              <p className="section-label">APPLICATION ACCESS</p>
              <h2>Enter Your Confirmation Code</h2>
              <p>
                After the admissions team confirms your payment,
                enter the unique code sent to your email or WhatsApp.
              </p>
            </div>

            <form
              className="applicant-payment-form"
              onSubmit={handleCodeVerification}
            >
              <div className="payment-form-group">
                <label htmlFor="applicationConfirmationCode">
                  Application Confirmation Code
                </label>
                <input
                  id="applicationConfirmationCode"
                  type="text"
                  value={confirmationCode}
                  onChange={(event) =>
                    setConfirmationCode(event.target.value.toUpperCase())
                  }
                  placeholder="SKY-XXXXX-XXXXX-XXXXX-XXXXX"
                  maxLength={27}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </div>

              <button
                type="submit"
                className="payment-start-button"
                disabled={isVerifyingCode || !confirmationCode.trim()}
              >
                {isVerifyingCode
                  ? 'Verifying Code...'
                  : 'Verify Code and Unlock Application'}
              </button>
            </form>

            {codeStatus && (
              <p className="payment-form-status" role="status" aria-live="polite">
                {codeStatus}
              </p>
            )}
          </section>
        )}

        {applicationAccessToken && (
          <>
            <p className="payment-code-success" role="status">
              Your confirmation code has been accepted.
              You can now complete your admission application.
            </p>

            <PaidAdmissionApplicationForm
              accessToken={applicationAccessToken}
            />
          </>
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