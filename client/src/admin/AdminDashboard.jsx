
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { API_BASE_URL } from '../api.js'
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
        <div>
          <h1>SKYROUTING</h1>
          <p>AVIATION TRAINING SCHOOL</p>
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
          </section>
        </div>
      )}

    </main>
  )
}

export default AdminDashboard
