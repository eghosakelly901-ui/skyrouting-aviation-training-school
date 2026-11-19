import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { API_BASE_URL } from '../api.js'
import './AdminLogin.css'

function AdminLogin() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(
  `${API_BASE_URL}/api/admin/login`,
  {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            email,
            password,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to sign in.'
        )
      }

      navigate('/admin/dashboard', {
        replace: true,
      })

    } catch (err) {
      setError(
        err.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <div className="admin-login-card">

        <div className="admin-login-brand">
          <h1>SKYROUTING</h1>
          <p>AVIATION TRAINING SCHOOL</p>
        </div>

        <div className="admin-login-heading">
          <h2>Administrator Portal</h2>
          <p>
            Sign in to manage admission enquiries
            and student applications.
          </p>
        </div>

        <form
          className="admin-login-form"
          onSubmit={handleSubmit}
        >
          <div className="admin-login-field">
            <label htmlFor="admin-email">
              Email Address
            </label>

            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your administrator email"
              autoComplete="username"
              maxLength={254}
              required
            />
          </div>

          <div className="admin-login-field">
            <label htmlFor="admin-password">
              Password
            </label>

            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </div>

          {error && (
            <div className="admin-login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="admin-login-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="admin-login-footer">
          <Link to="/">
            Return to Public Website
          </Link>

          <p>Authorised personnel only</p>
        </div>

      </div>
    </main>
  )
}

export default AdminLogin