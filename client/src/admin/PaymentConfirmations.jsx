
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { API_BASE_URL } from '../api.js'
import './PaymentConfirmations.css'

function formatDate(value) {
  if (!value) return 'Not available'

  return new Date(value).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatAmount(amountKobo) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(amountKobo || 0) / 100)
}

function getWhatsAppNumber(number) {
  let digits = String(number || '').replace(/\D/g, '')

  // Convert Nigerian local mobile numbers to international format.
  if (digits.startsWith('0') && digits.length === 11) {
    digits = `234${digits.slice(1)}`
  }

  return digits
}

function PaymentConfirmations() {
  const navigate = useNavigate()

  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [generatedConfirmations, setGeneratedConfirmations] = useState([])
  const [copyStatus, setCopyStatus] = useState('')


  const requestPendingPayments = useCallback(async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/bank-transfer-payments/pending`,
      { credentials: 'include' }
    )

    if (response.status === 401) {
      navigate('/admin/login', { replace: true })
      return null
    }

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(
        result.message || 'Unable to load pending payments.'
      )
    }

    return Array.isArray(result.payments)
      ? result.payments
      : []
  }, [navigate])

  useEffect(() => {
    let active = true

    requestPendingPayments()
      .then((result) => {
        if (active && result !== null) {
          setPayments(result)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Unable to load pending payments.')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [requestPendingPayments])

  async function handleRefresh() {
    setRefreshing(true)
    setError('')

    try {
      const result = await requestPendingPayments()

      if (result !== null) {
        setPayments(result)
      }
    } catch (err) {
      setError(err.message || 'Unable to refresh pending payments.')
    } finally {
      setRefreshing(false)
    }
  }


  async function handleConfirmPayment(payment) {
    const isDemo = payment.is_demo === true

    const confirmationPrompt = isDemo
      ? `DEMONSTRATION PAYMENT ONLY.

No real money has been received.

This will generate a TEST application access code for ${payment.applicant_name}.

Do you want to continue with this demonstration approval?`
      : `IMPORTANT PAYMENT CHECK

Have you independently checked the school's bank account and confirmed that the full ₦10,000 has actually been received?

Applicant: ${payment.applicant_name}
Transfer reference: ${payment.transfer_reference}

Only continue if you have personally verified the money in the school's account.

Do you confirm this payment?`

    if (!window.confirm(confirmationPrompt)) {
      return
    }

    setConfirmingId(String(payment.id))
    setError('')
    setCopyStatus('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/bank-transfer-payments/${payment.id}/confirm`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.status === 401) {
        navigate('/admin/login', { replace: true })
        return
      }

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to confirm this payment.'
        )
      }

      setGeneratedConfirmations((current) => [
        result.data,
        ...current,
      ])

      setPayments((current) =>
        current.filter(
          (item) => String(item.id) !== String(payment.id)
        )
      )

    } catch (err) {
      setError(
        err.message || 'Payment confirmation failed.'
      )
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleCopy(text, label) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus(`${label} copied successfully.`)
    } catch {
      setCopyStatus(
        'Copying was unsuccessful. Please select and copy the text manually.'
      )
    }
  }

  return (
    <section className="admin-enquiries-section payment-confirmations-section">

      <div className="admin-section-heading">
        <div>
          <h3>Payment Confirmations</h3>
          <p>
            Review bank transfers and issue applicant access codes.
          </p>
        </div>

        <div className="payment-confirmation-actions">
          <span>{payments.length} pending payment(s)</span>

          <button
            type="button"
            className="admin-refresh-button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Payments'}
          </button>
        </div>
      </div>

      {error && (
        <p className="admin-dashboard-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading pending bank transfers...</p>
      ) : payments.length === 0 ? (
        <p className="admin-empty">
          There are currently no pending bank-transfer submissions.
        </p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-enquiry-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Transfer Details</th>
                <th>Amount</th>
                <th>Submission Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <strong>{payment.applicant_name}</strong>
                    <small>{payment.email}</small>
                    <small>{payment.applicant_mobile_number}</small>

                    {payment.is_demo && (
                      <span className="payment-demo-label">
                        DEMONSTRATION
                      </span>
                    )}
                  </td>

                  <td>
                    <strong>{payment.transfer_sender_name}</strong>
                    <small>
                      Reference: {payment.transfer_reference}
                    </small>
                    <small>
                      Transfer date: {payment.transfer_date}
                    </small>
                    <small>
                      Payment ID: {payment.id}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {formatAmount(payment.amount_kobo)}
                    </strong>
                  </td>

                  <td>
                    {formatDate(payment.transfer_submitted_at)}
                  </td>

                  <td>
                    <span className="payment-pending-label">
                      Awaiting confirmation
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="payment-confirm-button"
                      onClick={() => handleConfirmPayment(payment)}
                      disabled={confirmingId !== null}
                    >
                      {confirmingId === String(payment.id)
                        ? 'Confirming...'
                        : 'Confirm Payment & Generate Code'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {generatedConfirmations.length > 0 && (
        <div className="payment-generated-codes">

          <h3>Generated Application Access Codes</h3>

          <p className="payment-code-security-notice">
            These codes are displayed only when generated.
            Copy the code and message before leaving this page.
          </p>

          {generatedConfirmations.map((confirmation) => {
            const whatsappNumber = getWhatsAppNumber(
              confirmation.mobileNumber
            )

            const whatsappUrl =
              `https://wa.me/${whatsappNumber}` +
              `?text=${encodeURIComponent(
                confirmation.messageToApplicant
              )}`

            const emailUrl =
              `mailto:${encodeURIComponent(confirmation.email)}` +
              `?subject=${encodeURIComponent(
                'Skyrouting Application Payment Confirmation'
              )}` +
              `&body=${encodeURIComponent(
                confirmation.messageToApplicant
              )}`

            return (
              <article
                className="payment-generated-card"
                key={confirmation.paymentReference}
              >
                <div className="payment-generated-heading">
                  <div>
                    <h4>{confirmation.applicantName}</h4>
                    <small>
                      {confirmation.paymentReference}
                    </small>
                  </div>

                  <span className={
                    confirmation.isDemo
                      ? 'payment-demo-label'
                      : 'payment-approved-label'
                  }>
                    {confirmation.approvalLabel}
                  </span>
                </div>

                <p>
                  <strong>Applicant email:</strong>{' '}
                  {confirmation.email}
                </p>

                <p>
                  <strong>WhatsApp:</strong>{' '}
                  {confirmation.mobileNumber}
                </p>

                <div className="payment-generated-code">
                  <span>Application Access Code</span>

                  <strong>{confirmation.confirmationCode}</strong>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        confirmation.confirmationCode,
                        'Access code'
                      )
                    }
                  >
                    Copy Code
                  </button>
                </div>

                <p>
                  <strong>Code expires:</strong>{' '}
                  {formatDate(confirmation.codeExpiresAt)}
                </p>

                <p>
                  <strong>Confirmed by:</strong>{' '}
                  {confirmation.confirmedBy}
                </p>

                <label className="payment-message-label">
                  Personalised message to applicant
                </label>

                <textarea
                  readOnly
                  rows={12}
                  value={confirmation.messageToApplicant}
                />

                <div className="payment-message-actions">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        confirmation.messageToApplicant,
                        'Applicant message'
                      )
                    }
                  >
                    Copy Full Message
                  </button>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open WhatsApp
                  </a>

                  <a href={emailUrl}>
                    Prepare Email
                  </a>
                </div>

                {confirmation.isDemo && (
                  <p className="payment-demo-warning">
                    DEMONSTRATION ONLY. No actual payment was received.
                    Do not send this test code as proof of a genuine payment.
                  </p>
                )}
              </article>
            )
          })}

          {copyStatus && (
            <p className="payment-copy-status" role="status">
              {copyStatus}
            </p>
          )}
        </div>
      )}

    </section>
  )
}

export default PaymentConfirmations
