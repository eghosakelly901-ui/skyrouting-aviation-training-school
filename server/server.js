require('dotenv').config()
const {
  randomBytes,
  createHash,
  scrypt,
  timingSafeEqual,
} = require('node:crypto')

const { promisify } = require('node:util')

const scryptAsync = promisify(scrypt)

const {
  requireAdmin,
  SESSION_COOKIE,
  getCookieOptions,
  getCookie,
} = require('./auth')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const pool = require('./db')
const admissionPaymentsRouter = require('./routes/admissionPayments')
const admissionApplicationsRouter = require('./routes/admissionApplications')
const bankTransferPaymentsRouter = require('./routes/bankTransferPayments')
const admissionPassportPhotosRouter = require('./routes/admissionPassportPhotos')
const adminPaidApplicationsRouter = require('./routes/adminPaidApplications')
const adminBankTransferPaymentsRouter = require('./routes/adminBankTransferPayments')

const app = express()

app.use(
  helmet({
    // The frontend is hosted separately; configure its CSP there.
    contentSecurityPolicy: false,

    // Enable HSTS only when the API is served over production HTTPS.
    hsts: process.env.NODE_ENV === 'production'
      ? {
          maxAge: 15552000,
          includeSubDomains: false,
        }
      : false,
  })
)

const PORT = process.env.PORT || 4000

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const allowedCourses = new Set([
  'flight-dispatch',
  'cabin-crew',
  'aviation-management',
  'helicopter-landing-officers',
  'quality-management',
  'safety-management-system',
  'radio-telephony',
  'search-and-rescue',
  'dangerous-goods',
])

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
}))

app.use(express.json({ limit: '10kb' }))

// ADMIN CSRF ORIGIN VALIDATION
// Protect administrator state-changing requests.
const trustedClientOrigin = new URL(CLIENT_ORIGIN).origin

const adminMutationMethods = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
])

app.use('/api/admin', (req, res, next) => {
  if (!adminMutationMethods.has(req.method)) {
    return next()
  }

  const requestOrigin = req.get('Origin')

  if (!requestOrigin) {
    return res.status(403).json({
      message: 'Request origin could not be verified.',
    })
  }

  let normalizedOrigin

  try {
    normalizedOrigin = new URL(requestOrigin).origin
  } catch {
    return res.status(403).json({
      message: 'Invalid request origin.',
    })
  }

  if (normalizedOrigin !== trustedClientOrigin) {
    return res.status(403).json({
      message: 'This request origin is not authorized.',
    })
  }

  return next()
})

app.use('/api/admissions/payments', admissionPaymentsRouter)
app.use('/api/admissions/bank-transfer', bankTransferPaymentsRouter)
app.use('/api/admissions/applications', admissionApplicationsRouter)
app.use('/api/admissions/passport-photos', admissionPassportPhotosRouter)
app.use('/api/admin/paid-applications', adminPaidApplicationsRouter)
app.use(
  '/api/admin/bank-transfer-payments',
  adminBankTransferPaymentsRouter
)

// Backend and database health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')

    return res.status(200).json({
      status: 'ok',
      service: 'skyrouting-api',
      database: 'connected',
      message: 'Skyrouting backend and database are running successfully.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Database health check failed:', error.message)

    return res.status(503).json({
      status: 'error',
      service: 'skyrouting-api',
      database: 'disconnected',
      message: 'Backend is running but database connection failed.',
      timestamp: new Date().toISOString(),
    })
  }
})
// PERSISTENT POSTGRESQL LOGIN ATTEMPT RATE LIMITING
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_LOGIN_ATTEMPTS = 5

function getLoginAttemptKey(req) {
  if (process.env.RENDER === 'true') {
    const isIP = require('node:net').isIP

    const cloudflareIp = req.get('CF-Connecting-IP')
    const forwardedFor = req.get('X-Forwarded-For')

    const cloudflareCandidate =
      typeof cloudflareIp === 'string'
        ? cloudflareIp.trim()
        : ''

    const forwardedCandidate =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : ''

    const candidate =
      isIP(cloudflareCandidate) !== 0
        ? cloudflareCandidate
        : forwardedCandidate

    if (!candidate || isIP(candidate) === 0) {
      return null
    }

    return `render:${candidate.toLowerCase()}`
  }

  const socketIp = req.socket?.remoteAddress

  if (
    typeof socketIp !== 'string' ||
    require('node:net').isIP(socketIp) === 0
  ) {
    return null
  }

  return `local:${socketIp.toLowerCase()}`
}

// Administrator login
app.post('/api/admin/login', async (req, res) => {
  const attemptKey = getLoginAttemptKey(req)

  if (!attemptKey) {
    return res.status(503).json({
      message: 'Client IP could not be verified. Login is temporarily unavailable.',
    })
  }

  const clientKey = createHash('sha256')
    .update(attemptKey)
    .digest('hex')

  const body = req.body || {}

  const email =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''

  const password =
    typeof body.password === 'string'
      ? body.password
      : ''

  if (
    !email ||
    !password ||
    email.length > 254 ||
    password.length > 128
  ) {
    return res.status(400).json({
      message: 'Please provide valid login credentials.',
    })
  }

  let client
  let transactionStarted = false

  try {
    client = await pool.connect()

    await client.query('BEGIN')
    transactionStarted = true

    // Ensure a row exists before acquiring its lock.
    await client.query(
      `INSERT INTO public.admin_login_attempts (client_key)
       VALUES ($1)
       ON CONFLICT (client_key) DO NOTHING`,
      [clientKey]
    )

    // Lock this visitor's row to serialize concurrent login attempts.
    const attemptResult = await client.query(
      `SELECT
          failed_attempts,
          (
            window_started_at <=
            NOW() - ($2::double precision * INTERVAL '1 millisecond')
          ) AS window_expired,
          GREATEST(
            1,
            CEIL(
              EXTRACT(
                EPOCH FROM (
                  window_started_at +
                  ($2::double precision * INTERVAL '1 millisecond')
                  - NOW()
                )
              )
            )
          )::integer AS retry_after_seconds
       FROM public.admin_login_attempts
       WHERE client_key = $1
       FOR UPDATE`,
      [clientKey, LOGIN_ATTEMPT_WINDOW_MS]
    )

    if (attemptResult.rows.length !== 1) {
      throw new Error('Unable to retrieve login attempt record.')
    }

    let attempt = attemptResult.rows[0]

    // Start a fresh window after the previous 15-minute window expires.
    if (attempt.window_expired) {
      const resetResult = await client.query(
        `UPDATE public.admin_login_attempts
         SET window_started_at = NOW(),
             failed_attempts = 0,
             updated_at = NOW()
         WHERE client_key = $1
         RETURNING failed_attempts`,
        [clientKey]
      )

      attempt = {
        ...attempt,
        failed_attempts: resetResult.rows[0].failed_attempts,
        retry_after_seconds: Math.ceil(
          LOGIN_ATTEMPT_WINDOW_MS / 1000
        ),
      }
    }

    if (Number(attempt.failed_attempts) >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const retryAfterSeconds = Number(
        attempt.retry_after_seconds
      )

      await client.query('COMMIT')
      transactionStarted = false

      res.set('Retry-After', String(retryAfterSeconds))

      return res.status(429).json({
        message: 'Too many unsuccessful login attempts. Please try again later.',
        retryAfterSeconds,
      })
    }

    const result = await client.query(
      `SELECT
          id,
          email,
          password_salt,
          password_hash,
          is_active
       FROM admin_users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    )

    const admin = result.rows[0]

    const salt = admin
      ? admin.password_salt
      : randomBytes(16)

    const expectedHash = admin
      ? admin.password_hash
      : Buffer.alloc(64)

    const suppliedHash = await scryptAsync(
      password,
      salt,
      64
    )

    const passwordMatches = timingSafeEqual(
      suppliedHash,
      expectedHash
    )

    if (!admin || !admin.is_active || !passwordMatches) {
      await client.query(
        `UPDATE public.admin_login_attempts
         SET failed_attempts = failed_attempts + 1,
             updated_at = NOW()
         WHERE client_key = $1`,
        [clientKey]
      )

      await client.query('COMMIT')
      transactionStarted = false

      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    // A successful login clears this visitor's failed-attempt record.
    await client.query(
      `DELETE FROM public.admin_login_attempts
       WHERE client_key = $1`,
      [clientKey]
    )

    const token = randomBytes(32).toString('base64url')

    const tokenHash = createHash('sha256')
      .update(token)
      .digest()

    const expiresAt = new Date(
      Date.now() + 8 * 60 * 60 * 1000
    )

    await client.query(
      `INSERT INTO admin_sessions
        (token_hash, admin_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, admin.id, expiresAt]
    )

    await client.query('COMMIT')
    transactionStarted = false

    res.cookie(
      SESSION_COOKIE,
      token,
      {
        ...getCookieOptions(),
        maxAge: 8 * 60 * 60 * 1000,
      }
    )

    return res.status(200).json({
      message: 'Administrator login successful.',
      data: {
        id: admin.id,
        email: admin.email,
        expiresAt,
      },
    })

  } catch (error) {
    if (client && transactionStarted) {
      await client.query('ROLLBACK').catch(() => {})
    }

    console.error('Administrator login error:', error.message)

    return res.status(500).json({
      message: 'Unable to complete administrator login.',
    })
  } finally {
    if (client) {
      client.release()
    }
  }
})
// Get the currently authenticated administrator
app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.status(200).json({
    data: {
      id: req.admin.id,
      email: req.admin.email,
    },
  })
})
// Retrieve admission enquiries for authenticated administrators
app.get('/api/admin/enquiries', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          id,
          full_name,
          email,
          phone,
          course_id,
          message,
          status,
          created_at
       FROM admission_enquiries
       ORDER BY created_at DESC, id DESC`
    )

    return res.status(200).json({
      message: 'Admission enquiries retrieved successfully.',
      data: result.rows,
      total: result.rows.length,
    })

  } catch (error) {
    console.error('Admin enquiries retrieval error:', error.message)

    return res.status(500).json({
      message: 'Unable to retrieve admission enquiries.',
    })
  }
})

// Update admission enquiry status
app.patch(
  '/api/admin/enquiries/:id/status',
  requireAdmin,
  async (req, res) => {
    const { id } = req.params

    const status =
      typeof req.body?.status === 'string'
        ? req.body.status.trim().toLowerCase()
        : ''

    const allowedStatuses = [
      'pending',
      'contacted',
      'reviewed',
    ]

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        message: 'Invalid enquiry reference.',
      })
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid enquiry status.',
      })
    }

    try {
      const result = await pool.query(
        `UPDATE admission_enquiries
         SET status = $1
         WHERE id = $2
         RETURNING id, status`,
        [status, id]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Admission enquiry not found.',
        })
      }

      return res.status(200).json({
        message: 'Enquiry status updated successfully.',
        data: result.rows[0],
      })

    } catch (error) {
      console.error('Enquiry status update error:', error.message)

      return res.status(500).json({
        message: 'Unable to update enquiry status.',
      })
    }
  }
)

// Administrator logout
app.post('/api/admin/logout', async (req, res) => {
  const token = getCookie(req, SESSION_COOKIE)

  try {
    if (token) {
      const tokenHash = createHash('sha256')
        .update(token)
        .digest()

      await pool.query(
        'DELETE FROM admin_sessions WHERE token_hash = $1',
        [tokenHash]
      )
    }

    res.clearCookie(
      SESSION_COOKIE,
      getCookieOptions()
    )

    return res.status(200).json({
      message: 'Administrator logout successful.',
    })

  } catch (error) {
    console.error('Administrator logout error:', error.message)

    return res.status(500).json({
      message: 'Unable to complete administrator logout.',
    })
  }
})

// Receive admission enquiries
app.post('/api/enquiries', async (req, res) => {
  const body = req.body || {}

  const fullName =
    typeof body.fullName === 'string' ? body.fullName.trim() : ''

  const email =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''

  const phone =
    typeof body.phone === 'string' ? body.phone.trim() : ''

  const course =
    typeof body.course === 'string' ? body.course.trim() : ''

  const message =
    typeof body.message === 'string' ? body.message.trim() : ''

  if (!fullName || !email || !phone || !course || !message) {
    return res.status(400).json({
      message: 'Please complete all required fields.',
    })
  }

  if (
    fullName.length > 120 ||
    email.length > 254 ||
    phone.length > 30 ||
    message.length > 5000
  ) {
    return res.status(400).json({
      message: 'One or more fields exceed the permitted length.',
    })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      message: 'Please provide a valid email address.',
    })
  }

  if (!allowedCourses.has(course)) {
    return res.status(400).json({
      message: 'Please select a valid training course.',
    })
  }

  try {
    const result = await pool.query(
      `INSERT INTO admission_enquiries
        (full_name, email, phone, course_id, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [fullName, email, phone, course, message]
    )

    return res.status(201).json({
      message: 'Your admission enquiry has been received successfully.',
      data: {
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at,
      },
    })
  } catch (error) {
    console.error('Admission enquiry database error:', error.message)

    return res.status(500).json({
      message: 'Unable to submit your enquiry right now. Please try again.',
    })
  }
})

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    message: 'API route not found.',
  })
})

// Handle unexpected API errors
app.use((error, req, res, next) => {
  console.error('API error:', error.message)

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    'body' in error
  ) {
    return res.status(400).json({
      message: 'Invalid JSON request body.',
    })
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Request body is too large.',
    })
  }

  return res.status(500).json({
    message: 'An unexpected server error occurred.',
  })
})

// EXPIRED ADMIN SESSION CLEANUP
const ADMIN_SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000

async function cleanupExpiredAdminSessions() {
  try {
    const result = await pool.query(
      `DELETE FROM public.admin_sessions
       WHERE expires_at <= NOW()`
    )

    if (result.rowCount > 0) {
      console.log(
        `Removed ${result.rowCount} expired administrator session(s).`
      )
    }
  } catch (error) {
    console.error(
      'Expired administrator session cleanup failed:',
      error.message
    )
  }
}

cleanupExpiredAdminSessions()

const adminSessionCleanupTimer = setInterval(
  cleanupExpiredAdminSessions,
  ADMIN_SESSION_CLEANUP_INTERVAL_MS
)

adminSessionCleanupTimer.unref()
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Skyrouting API is running on port ${PORT}`)
})