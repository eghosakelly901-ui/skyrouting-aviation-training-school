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
const pool = require('./db')
const admissionPaymentsRouter = require('./routes/admissionPayments')
const admissionApplicationsRouter = require('./routes/admissionApplications')
const admissionPassportPhotosRouter = require('./routes/admissionPassportPhotos')

const app = express()

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
app.use('/api/admissions/payments', admissionPaymentsRouter)
app.use('/api/admissions/applications', admissionApplicationsRouter)
app.use('/api/admissions/passport-photos', admissionPassportPhotosRouter)

// Backend health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'skyrouting-api',
    message: 'Skyrouting backend is running successfully.',
    timestamp: new Date().toISOString(),
  })
})

// Administrator login
app.post('/api/admin/login', async (req, res) => {
  const body = req.body || {}

  const email =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''

  const password =
    typeof body.password === 'string'
      ? body.password
      : ''

  if (!email || !password || email.length > 254 ||
      password.length > 128) {
    return res.status(400).json({
      message: 'Please provide valid login credentials.',
    })
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_salt,
              password_hash, is_active
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
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const token = randomBytes(32).toString('base64url')

    const tokenHash = createHash('sha256')
      .update(token)
      .digest()

    const expiresAt = new Date(
      Date.now() + 8 * 60 * 60 * 1000
    )

    await pool.query(
      `INSERT INTO admin_sessions
        (token_hash, admin_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, admin.id, expiresAt]
    )

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
    console.error('Administrator login error:', error.message)

    return res.status(500).json({
      message: 'Unable to complete administrator login.',
    })
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

app.listen(PORT, () => {
  console.log(`Skyrouting API is running on port ${PORT}`)
})