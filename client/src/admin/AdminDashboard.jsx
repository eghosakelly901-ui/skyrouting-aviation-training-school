
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { API_BASE_URL } from '../api.js'
import PaymentConfirmations from './PaymentConfirmations.jsx'
import './AdminDashboard.css'


const courseNames = {
  'flight-dispatch': 'Flight Dispatch',
  'cabin-crew': 'Cabin Crew',
  'aviation-management': 'Aviation Management',
  'helicopter-landing-officers': 'Helicopter Landing Officers',
  'quality-management': 'Quality Management',
  'safety-management-system': 'Safety Management System',
  'radio-telephony': 'Radio Telephony',
  'search-and-rescue': 'Search and Rescue',
  'dangerous-goods': 'Dangerous Goods',
}

function AdminDashboard() {
  const navigate = useNavigate()

  const [admin, setAdmin] = useState(null)
  const [enquiries, setEnquiries] = useState([])
 const [paidApplications, setPaidApplications] = useState([])
const [applicationsLoading, setApplicationsLoading] = useState(true)
const [applicationsError, setApplicationsError] = useState('')
const [selectedApplication, setSelectedApplication] = useState(null)
const [applicationDetails, setApplicationDetails] = useState(null)
const [applicationUpdating, setApplicationUpdating] = useState(false)
const [photoUrl, setPhotoUrl] = useState('')
const [admissionNotification, setAdmissionNotification] = useState(null)
const [admissionNotificationCopyStatus, setAdmissionNotificationCopyStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [selectedEnquiry, setSelectedEnquiry] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
const [statusFilter, setStatusFilter] = useState('all')
const [courseFilter, setCourseFilter] = useState('all')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      try {
        const adminResponse = await fetch(
  `${API_BASE_URL}/api/admin/me`,
  { credentials: 'include' }
)

        if (adminResponse.status === 401) {
          navigate('/admin/login', { replace: true })
          return
        }

        const adminResult = await adminResponse.json()

        if (!adminResponse.ok) {
          throw new Error(
            adminResult.message || 'Unable to verify administrator.'
          )
        }

               const enquiryResponse = await fetch(
          `${API_BASE_URL}/api/admin/enquiries`,
          {
            credentials: 'include',
          }
        )

        const enquiryResult = await enquiryResponse.json()

        if (!enquiryResponse.ok) {
          throw new Error(
            enquiryResult.message || 'Unable to load enquiries.'
          )
        }

        if (active) {
          setAdmin(adminResult.data)
          setEnquiries(enquiryResult.data)

        try {
          const applicationsResponse = await fetch(
            `${API_BASE_URL}/api/admin/paid-applications`,
            { credentials: 'include' }
          )

          if (applicationsResponse.status === 401) {
            navigate('/admin/login', { replace: true })
            return
          }

          const applicationsResult = await applicationsResponse.json()

          if (!applicationsResponse.ok) {
            throw new Error(
              applicationsResult.message ||
              'Unable to load paid applications.'
            )
          }

          if (active) {
            setPaidApplications(applicationsResult.applications || [])
          }
        } catch (applicationsErr) {
          if (active) {
            setApplicationsError(applicationsErr.message)
          }
        } finally {
          if (active) {
            setApplicationsLoading(false)
          }
        }

        }

      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [navigate])
  async function handleRefresh() {
    setRefreshing(true)
    setError('')

    try {
      const response = await fetch(
  `${API_BASE_URL}/api/admin/enquiries`,
  {
    credentials: 'include',
  }
)

      if (response.status === 401) {
        navigate('/admin/login', { replace: true })
        return
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to refresh enquiries.'
        )
      }

      setEnquiries(result.data)

    } catch (err) {
      setError(err.message || 'Unable to refresh enquiries.')
    } finally {
      setRefreshing(false)
    }
  }

  function handleExportCsv() {
    const headers = [
      'Reference',
      'Applicant',
      'Email',
      'Telephone',
      'Course',
      'Status',
      'Date Received',
      'Message',
    ]

    function escapeCsv(value) {
      let text = String(value ?? '')

      // Prevent spreadsheet formula injection.
      if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
        text = `'${text}`
      }

      return `"${text.replace(/"/g, '""')}"`
    }

    const rows = filteredEnquiries.map((enquiry) => [
      enquiry.id,
      enquiry.full_name,
      enquiry.email,
      enquiry.phone,
      courseNames[enquiry.course_id] || enquiry.course_id,
      enquiry.status,
      new Date(enquiry.created_at).toLocaleString(),
      enquiry.message,
    ])

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n')

    const blob = new Blob(
      ['\uFEFF', csvContent],
      { type: 'text/csv;charset=utf-8;' }
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `skyrouting-admission-enquiries-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function handleStatusChange(enquiryId, newStatus) {
    setUpdatingId(String(enquiryId))
    setError('')

    try {
      const response = await fetch(
  `${API_BASE_URL}/api/admin/enquiries/${enquiryId}/status`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ status: newStatus }),
  }
)
 const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to update enquiry status.'
        )
      }

      setEnquiries((currentEnquiries) =>
        currentEnquiries.map((enquiry) =>
          String(enquiry.id) === String(enquiryId)
            ? { ...enquiry, status: result.data.status }
            : enquiry
        )
      )

    } catch (err) {
      setError(err.message || 'Status update failed.')
    } finally {
      setUpdatingId(null)
    }
  }
    async function handleArchiveEnquiry(enquiryId) {
    const confirmed = window.confirm(
      'Are you sure you want to archive this admission enquiry?'
    )

    if (!confirmed) return

    setUpdatingId(String(enquiryId))
    setError('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/enquiries/${enquiryId}/archive`,
        {
          method: 'PATCH',
          credentials: 'include',
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to archive admission enquiry.'
        )
      }

      setEnquiries((currentEnquiries) =>
        currentEnquiries.filter(
          (enquiry) => String(enquiry.id) !== String(enquiryId)
        )
      )

      setSelectedEnquiry(null)
    } catch (err) {
      setError(err.message || 'Enquiry archiving failed.')
    } finally {
      setUpdatingId(null)
    }
  }
  async function handleViewApplication(application) {
    setSelectedApplication(application)
    setApplicationDetails(null)
    setPhotoUrl('')
    setApplicationsError('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/paid-applications/${application.id}`,
        { credentials: 'include' }
      )

      if (response.status === 401) {
        navigate('/admin/login', { replace: true })
        return
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to load application details.'
        )
      }

      setApplicationDetails(result.application)
    } catch (err) {
      setApplicationsError(err.message)
    }
  }  async function handleDecisionChange(applicationId, decision) {
    setApplicationUpdating(true)
    setApplicationsError('')
    setAdmissionNotification(null)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/paid-applications/${applicationId}/decision`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ decision }),
        }
      )

      if (response.status === 401) {
        navigate('/admin/login', { replace: true })
        return
      }

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to update admission decision.'
        )
      }

      setPaidApplications((current) =>
        current.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                admission_decision: result.application.admission_decision,
              }
            : application
        )
      )

      setApplicationDetails((current) =>
        current && current.id === applicationId
          ? {
              ...current,
              admission_decision: result.application.admission_decision,
            }
          : current
      )

      setAdmissionNotification(result.notification || null)

    } catch (err) {
      setApplicationsError(err.message)
    } finally {
      setApplicationUpdating(false)
    }
  }
async function handleViewPassportPhoto(applicationId) {
    setApplicationsError('')
    setPhotoUrl('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/paid-applications/${applicationId}/passport-photo`,
        { credentials: 'include' }
      )

      if (response.status === 401) {
        navigate('/admin/login', { replace: true })
        return
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to retrieve passport photograph.'
        )
      }

      setPhotoUrl(result.photoUrl)
    } catch (err) {
      setApplicationsError(err.message)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)

    try {
      const response = await fetch(
  `${API_BASE_URL}/api/admin/logout`,
  {
    method: 'POST',
    credentials: 'include',
  }
)

      if (!response.ok) {
        throw new Error('Unable to log out. Please try again.')
      }

      navigate('/admin/login', { replace: true })

    } catch (err) {
      setError(err.message)
      setLoggingOut(false)
    }
  }

  const pendingCount = enquiries.filter(
    (item) => item.status === 'pending'
  ).length

  const contactedCount = enquiries.filter(
    (item) => item.status === 'contacted'
  ).length

  const reviewedCount = enquiries.filter(
    (item) => item.status === 'reviewed'
  ).length
  const filteredEnquiries = enquiries.filter((enquiry) => {
  const search = searchTerm.trim().toLowerCase()

  const matchesSearch = [
    enquiry.full_name,
    enquiry.email,
    enquiry.phone,
  ].some((value) =>
    String(value || '').toLowerCase().includes(search)
  )

  const matchesStatus =
    statusFilter === 'all' ||
    enquiry.status === statusFilter

  const matchesCourse =
    courseFilter === 'all' ||
    enquiry.course_id === courseFilter

  return matchesSearch && matchesStatus && matchesCourse
})

  if (loading) {
    return (
      <main className="admin-loading">
        Loading administration dashboard...
      </main>
    )
  }

  if (error && !admin) {
    return (
      <main className="admin-loading">
        <p>{error}</p>
        <button onClick={() => navigate('/admin/login')}>
          Return to Login
        </button>
      </main>
    )
  }

  return (
    <main className="admin-dashboard">

      <header className="admin-topbar">
  <div className="admin-dashboard-brand">
    <img
      src="/images/skyrouting-logo.webp"
      alt="Skyrouting Aviation Training School"
      className="admin-dashboard-logo"
    />
  </div>

        <div className="admin-topbar-right">
          <span>{admin?.email}</span>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </header>

      <section className="admin-dashboard-content">

        <div className="admin-welcome">
          <div>
            <h2>Administration Dashboard</h2>
            <p>
              Manage and monitor student admission enquiries.
            </p>
          </div>
        </div>

        {error && (
          <div className="admin-dashboard-error" role="alert">
            {error}
          </div>
        )}

        <div className="admin-stat-grid">

          <div className="admin-stat-card">
            <span>Total Enquiries</span>
            <strong>{enquiries.length}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Pending</span>
            <strong>{pendingCount}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Contacted</span>
            <strong>{contactedCount}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Reviewed</span>
            <strong>{reviewedCount}</strong>
          </div>

        </div>

        <section className="admin-enquiries-section">

          <div className="admin-section-heading">
  <h3>Admission Enquiries</h3>

  <div className="admin-section-actions">
    <span>
      Showing {filteredEnquiries.length} of {enquiries.length} records
    </span>

    <button
      type="button"
      className="admin-refresh-button"
      onClick={handleRefresh}
      disabled={refreshing}
    >
      {refreshing ? 'Refreshing...' : 'Refresh Enquiries'}
    </button>
    <button
  type="button"
  className="admin-export-button"
  onClick={handleExportCsv}
  disabled={filteredEnquiries.length === 0}
>
  Export CSV
</button>
  </div>
</div>

<div className="admin-enquiry-filters">

  <div className="admin-filter-field">
    <label htmlFor="enquiry-search">
      Search applicants
    </label>

    <input
      id="enquiry-search"
      type="search"
      placeholder="Search name, email or phone..."
      value={searchTerm}
      onChange={(event) => setSearchTerm(event.target.value)}
    />
  </div>

  <div className="admin-filter-field">
    <label htmlFor="status-filter">
      Filter by status
    </label>

    <select
      id="status-filter"
      value={statusFilter}
      onChange={(event) => setStatusFilter(event.target.value)}
    >
      <option value="all">All statuses</option>
      <option value="pending">Pending</option>
      <option value="contacted">Contacted</option>
      <option value="reviewed">Reviewed</option>
    </select>
  </div>

  <div className="admin-filter-field">
    <label htmlFor="course-filter">
      Filter by course
    </label>

    <select
      id="course-filter"
      value={courseFilter}
      onChange={(event) => setCourseFilter(event.target.value)}
    >
      <option value="all">All courses</option>

      {Object.entries(courseNames).map(([value, name]) => (
        <option key={value} value={value}>
          {name}
        </option>
      ))}
    </select>
  </div>

</div>

          {enquiries.length === 0 ? (
  <p className="admin-empty">
    No admission enquiries have been received yet.
  </p>
) : filteredEnquiries.length === 0 ? (
  <p className="admin-empty">
    No enquiries match your search or selected filters.
  </p>
) : (
            <div className="admin-table-wrapper">
              <table className="admin-enquiry-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Contact</th>
                    <th>Course</th>
                    <th>Status</th>
                    <th>Date Received</th>


                    <th>Enquiry</th>
                  </tr>
                 </thead>
                <tbody>
                  {filteredEnquiries.map((enquiry) => (
                    <tr key={enquiry.id}>
                      <td>
                        <strong>{enquiry.full_name}</strong>
                        <small>Reference #{enquiry.id}</small>
                      </td>

                      <td>
                        <span>{enquiry.email}</span>
                        <small>{enquiry.phone}</small>
                      </td>

                      <td>
                        {courseNames[enquiry.course_id] ||
                          enquiry.course_id}
                      </td>

                      <td>
                        <select
                          className={`admin-status-select ${enquiry.status}`}
                          value={enquiry.status}
                          disabled={
                            updatingId === String(enquiry.id)
                          }
                          aria-label={
                            `Update status for ${enquiry.full_name}`
                          }
                          onChange={(event) =>
                            handleStatusChange(
                              enquiry.id,
                              event.target.value
                            )
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="contacted">Contacted</option>
                          <option value="reviewed">Reviewed</option>
                        </select>

                        {updatingId === String(enquiry.id) && (
                          <small>Saving...</small>
                        )}
                      </td>

                      <td>
  {new Date(
    enquiry.created_at
  ).toLocaleString()}
</td>

<td>
  <button
    type="button"
    className="admin-view-button"
    onClick={() => setSelectedEnquiry(enquiry)}
  >
    View Message
  </button>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

                </section>
        <PaymentConfirmations />
      <section className="admin-enquiries-section admin-paid-applications-section">
          <div className="admin-section-heading">
            <h3>Paid Applications</h3>
            <span>
              {paidApplications.length} application(s)
            </span>
          </div>

          {applicationsError && (
            <p className="admin-dashboard-error" role="alert">
              {applicationsError}
            </p>
          )}

          {applicationsLoading ? (
            <p>Loading paid applications...</p>
          ) : paidApplications.length === 0 ? (
            <p className="admin-empty">
              No paid applications have been submitted yet.
            </p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-enquiry-table">
                <thead>
                  <tr>
                    <th>Application Number</th>
                    <th>Applicant</th>
                    <th>Course</th>
                    <th>Payment</th>
                    <th>Admission Decision</th>
                    <th>Date Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paidApplications.map((application) => (
                    <tr key={application.id}>
                      <td>{application.application_number}</td>

                      <td>
                        <strong>
                          {[
                            application.first_name,
                            application.other_names,
                            application.surname,
                          ].filter(Boolean).join(' ')}
                        </strong>
                        <br />
                        <small>{application.email_address}</small>
                        <br />
                        <small>{application.mobile_number}</small>
                      </td>

                      <td>
                        {courseNames[application.selected_course] ||
                          application.selected_course}
                      </td>

                      <td>
                        <strong>
                          {new Intl.NumberFormat('en-NG', {
                            style: 'currency',
                            currency: application.currency || 'NGN',
                            maximumFractionDigits: 0,
                          }).format(
                            Number(application.amount_kobo || 0) / 100
                          )}
                        </strong>
                        <br />
                        <small>
                          {application.payment_status}
                        </small>
                      </td>

                      <td>
                        <select
                          className={`admin-status-select ${application.admission_decision}`}
                          value={application.admission_decision || 'pending'}
                          disabled={applicationUpdating}
                          aria-label={
                            `Admission decision for ${application.application_number}`
                          }
                          onChange={(event) =>
                            handleDecisionChange(
                              application.id,
                              event.target.value
                            )
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="not-approved">Not Approved</option>
                        </select>
                      </td>

                      <td>
                        {new Date(
                          application.created_at
                        ).toLocaleDateString()}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="admin-view-button"
                          onClick={() =>
                            handleViewApplication(application)
                          }
                        >
                          View Application
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {admissionNotification && (
          <section className="admin-enquiries-section admin-admission-notification">
            <div className="admin-section-heading">
              <div>
                <h3>Admission Decision Notification</h3>
                <p>Review the personalised message before sending it.</p>
              </div>

              <button
                type="button"
                className="admin-refresh-button"
                onClick={() => {
                  setAdmissionNotification(null)
                  setAdmissionNotificationCopyStatus('')
                }}
              >
                Dismiss
              </button>
            </div>

            {admissionNotification.isDemo && (
              <p className="admission-demo-notification-warning" role="alert">
                DEMONSTRATION ONLY — THIS IS NOT A REAL ADMISSION DECISION.
              </p>
            )}

            <div className="admission-notification-details">
              <p>
                <strong>Applicant:</strong>{' '}
                {admissionNotification.applicantName}
              </p>
              <p>
                <strong>Application Number:</strong>{' '}
                {admissionNotification.applicationNumber}
              </p>
              <p>
                <strong>Programme:</strong>{' '}
                {admissionNotification.courseName}
              </p>
              <p>
                <strong>Admission Decision:</strong>{' '}
                {admissionNotification.decision === 'approved'
                  ? 'APPROVED'
                  : 'NOT APPROVED'}
              </p>
              <p>
                <strong>Email:</strong>{' '}
                {admissionNotification.email || 'Not available'}
              </p>
              <p>
                <strong>Mobile Number:</strong>{' '}
                {admissionNotification.mobileNumber || 'Not available'}
              </p>
            </div>

            <label
              htmlFor="admission-notification-message"
              className="admission-notification-message-label"
            >
              Personalised message to applicant
            </label>

            <textarea
              id="admission-notification-message"
              className="admission-notification-message"
              rows={16}
              readOnly
              value={admissionNotification.message}
            />

            <div className="admission-notification-actions">
              <button
                type="button"
                className="admin-view-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      admissionNotification.message
                    )
                    setAdmissionNotificationCopyStatus(
                      'Admission message copied successfully.'
                    )
                  } catch {
                    setAdmissionNotificationCopyStatus(
                      'Copy failed. Please select and copy the message manually.'
                    )
                  }
                }}
              >
                Copy Message
              </button>

              {admissionNotification.mobileNumber && (
                <a
                  className="admission-notification-link"
                  href={`https://wa.me/${String(
                    admissionNotification.mobileNumber
                  ).replace(/\D/g, '').replace(/^0/, '234')}?text=${encodeURIComponent(
                    admissionNotification.message
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open WhatsApp
                </a>
              )}

              {admissionNotification.email && (
                <a
                  className="admission-notification-link"
                  href={`mailto:${encodeURIComponent(
                    admissionNotification.email
                  )}?subject=${encodeURIComponent(
                    admissionNotification.subject
                  )}&body=${encodeURIComponent(
                    admissionNotification.message
                  )}`}
                >
                  Prepare Email
                </a>
              )}
            </div>

            {admissionNotificationCopyStatus && (
              <p className="admission-notification-copy-status" role="status">
                {admissionNotificationCopyStatus}
              </p>
            )}

            <p className="admission-notification-delivery-note">
              Message prepared successfully. It has not been sent automatically.
              Review it before sending.
            </p>
          </section>
        )}
      </section>

      {selectedEnquiry && (
        <div className="admin-modal-backdrop">
          <section
            className="admin-message-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-message-title"
          >
            <div className="admin-modal-heading">
              <div>
                <h3 id="admin-message-title">
                  Admission Enquiry
                </h3>

                <p>Reference #{selectedEnquiry.id}</p>
              </div>

              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedEnquiry(null)}
                aria-label="Close enquiry details"
              >
              </button>
            </div>

            <div className="admin-message-details">
              <p>
                <strong>Applicant:</strong>{' '}
                {selectedEnquiry.full_name}
              </p>

              <p>
                <strong>Email:</strong>{' '}
                {selectedEnquiry.email}
              </p>

              <p>
                <strong>Telephone:</strong>{' '}
                {selectedEnquiry.phone}
              </p>

              <p>
                <strong>Course:</strong>{' '}
                {courseNames[selectedEnquiry.course_id] ||
                  selectedEnquiry.course_id}
              </p>

              <p>
                <strong>Status:</strong>{' '}
                {selectedEnquiry.status}
              </p>

              <p>
                <strong>Date received:</strong>{' '}
                {new Date(
                  selectedEnquiry.created_at
                ).toLocaleString()}
              </p>

              <div className="admin-full-message">
                <strong>Applicant's Message</strong>

                <p>{selectedEnquiry.message}</p>
              </div>
            </div>
          <div className="admin-modal-actions">
  <button
    type="button"
    onClick={() => handleArchiveEnquiry(selectedEnquiry.id)}
    disabled={updatingId === String(selectedEnquiry.id)}
  >
    {updatingId === String(selectedEnquiry.id)
      ? 'Archiving...'
      : 'Archive Enquiry'}
  </button>
</div>
    </section>
      </div>
      )}
      {selectedApplication && (
        <div className="admin-modal-backdrop">
          <section
            className="admin-message-modal admin-application-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-modal-title"
          >
            <div className="admin-modal-heading">
              <div>
                <h3 id="application-modal-title">
                  Paid Application Details
                </h3>

                <p>
                  Application Number:{' '}
                  {selectedApplication.application_number}
                </p>
              </div>

              <button
                type="button"
                className="admin-modal-close"
                onClick={() => {
                  setSelectedApplication(null)
                  setApplicationDetails(null)
                  setPhotoUrl('')
                  setApplicationsError('')
                }}
                aria-label="Close application details"
              >
              </button>
            </div>

            {applicationsError && (
              <p className="admin-dashboard-error" role="alert">
                {applicationsError}
              </p>
            )}

            {!applicationDetails ? (
              <p>Loading application details...</p>
            ) : (
              <div className="admin-message-details">

                <h4>Personal Information</h4>

                <p>
                  <strong>Full Name:</strong>{' '}
                  {[
                    applicationDetails.surname,
                    applicationDetails.first_name,
                    applicationDetails.other_names,
                  ].filter(Boolean).join(' ')}
                </p>

                <p>
                  <strong>Gender:</strong>{' '}
                  {applicationDetails.gender || 'Not provided'}
                </p>

                <p>
                  <strong>Date of Birth:</strong>{' '}
                  {applicationDetails.date_of_birth
                    ? new Date(
                        applicationDetails.date_of_birth
                      ).toLocaleDateString()
                    : 'Not provided'}
                </p>

                <p>
                  <strong>Marital Status:</strong>{' '}
                  {applicationDetails.marital_status || 'Not provided'}
                </p>

                <p>
                  <strong>Nationality:</strong>{' '}
                  {applicationDetails.nationality || 'Not provided'}
                </p>

                <p>
                  <strong>State of Origin:</strong>{' '}
                  {applicationDetails.state_of_origin || 'Not provided'}
                </p>

                <p>
                  <strong>Local Government Area:</strong>{' '}
                  {applicationDetails.lga || 'Not provided'}
                </p>

                <p>
                  <strong>Place of Birth:</strong>{' '}
                  {applicationDetails.place_of_birth || 'Not provided'}
                </p>

                <h4>Contact Information</h4>

                <p>
                  <strong>Email:</strong>{' '}
                  {applicationDetails.email_address}
                </p>

                <p>
                  <strong>Mobile Number:</strong>{' '}
                  {applicationDetails.mobile_number}
                </p>

                <p>
                  <strong>Residential Address:</strong>{' '}
                  {applicationDetails.residential_address || 'Not provided'}
                </p>

                <h4>Education and Course Selection</h4>

                <p>
                  <strong>Highest Qualification:</strong>{' '}
                  {applicationDetails.highest_qualification || 'Not provided'}
                </p>

                <p>
                  <strong>Year Obtained:</strong>{' '}
                  {applicationDetails.year_obtained || 'Not provided'}
                </p>

                <p>
                  <strong>School/Institution:</strong>{' '}
                  {applicationDetails.school_institution || 'Not provided'}
                </p>

                <p>
                  <strong>Selected Course:</strong>{' '}
                  {courseNames[applicationDetails.selected_course] ||
                    applicationDetails.selected_course}
                </p>

                <p>
                  <strong>Course Option:</strong>{' '}
                  {applicationDetails.course_option || 'Not provided'}
                </p>

                <p>
                  <strong>Accommodation Preference:</strong>{' '}
                  {applicationDetails.accommodation_preference ||
                    'Not provided'}
                </p>

                <h4>Next of Kin</h4>

                <p>
                  <strong>Full Name:</strong>{' '}
                  {applicationDetails.kin_full_name || 'Not provided'}
                </p>

                <p>
                  <strong>Relationship:</strong>{' '}
                  {applicationDetails.kin_relationship || 'Not provided'}
                </p>

                <p>
                  <strong>Telephone:</strong>{' '}
                  {applicationDetails.kin_phone || 'Not provided'}
                </p>

                <p>
                  <strong>Email:</strong>{' '}
                  {applicationDetails.kin_email || 'Not provided'}
                </p>

                <p>
                  <strong>Address:</strong>{' '}
                  {applicationDetails.kin_address || 'Not provided'}
                </p>

                <h4>Medical and Aviation Experience</h4>

                <p>
                  <strong>Medical Condition Declared:</strong>{' '}
                  {applicationDetails.has_medical_condition
                    ? 'Yes'
                    : 'No'}
                </p>

                {applicationDetails.has_medical_condition && (
                  <p>
                    <strong>Medical Condition Details:</strong>{' '}
                    {applicationDetails.medical_condition_details ||
                      'No details provided'}
                  </p>
                )}

                <p>
                  <strong>Previous Aviation Experience:</strong>{' '}
                  {applicationDetails.has_aviation_experience
                    ? 'Yes'
                    : 'No'}
                </p>

                {applicationDetails.has_aviation_experience && (
                  <p>
                    <strong>Experience Details:</strong>{' '}
                    {applicationDetails.aviation_experience_details ||
                      'No details provided'}
                  </p>
                )}

                <h4>Payment and Admission Status</h4>

                <p>
                  <strong>Payment Status:</strong>{' '}
                  {applicationDetails.payment_status}
                </p>

                <p>
                  <strong>Amount Paid:</strong>{' '}
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: applicationDetails.currency || 'NGN',
                    maximumFractionDigits: 0,
                  }).format(
                    Number(applicationDetails.amount_kobo || 0) / 100
                  )}
                </p>

                <p>
                  <strong>Payment Reference:</strong>{' '}
                  {applicationDetails.paystack_reference || 'Not available'}
                </p>

                <p>
                  <strong>Payment Date:</strong>{' '}
                  {applicationDetails.paid_at
                    ? new Date(
                        applicationDetails.paid_at
                      ).toLocaleString()
                    : 'Not available'}
                </p>

                <p>
                  <strong>Admission Decision:</strong>{' '}
                  {applicationDetails.admission_decision}
                </p>

                <p>
                  <strong>Application Date:</strong>{' '}
                  {new Date(
                    applicationDetails.created_at
                  ).toLocaleString()}
                </p>

                <p>
                  <strong>Applicant Declaration Accepted:</strong>{' '}
                  {applicationDetails.applicant_declaration_accepted
                    ? 'Yes'
                    : 'No'}
                </p>

                <h4>Passport Photograph</h4>

                <button
                  type="button"
                  className="admin-view-button"
                  onClick={() =>
                    handleViewPassportPhoto(applicationDetails.id)
                  }
                >
                  View Passport Photograph
                </button>

                {photoUrl && (
                  <div className="admin-application-photo">
                    <img
                      src={photoUrl}
                      alt="Applicant passport photograph"
                    />
                  </div>
                )}

              </div>
            )}
                  </section>
                  </div>
      )}
    </main>
  )
}

export default AdminDashboard


