const { createHash } = require('node:crypto')
const pool = require('./db')

const SESSION_COOKIE = 'skyrouting_admin_session'

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || ''

  const cookies = cookieHeader.split(';')

  for (const cookie of cookies) {
    const separator = cookie.indexOf('=')

    if (separator === -1) continue

    const key = cookie.slice(0, separator).trim()

    if (key === name) {
      return decodeURIComponent(
        cookie.slice(separator + 1).trim()
      )
    }
  }

  return null
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
  }
}

async function requireAdmin(req, res, next) {
  const token = getCookie(req, SESSION_COOKIE)

  if (!token) {
    return res.status(401).json({
      message: 'Administrator authentication required.',
    })
  }

  try {
    const tokenHash = createHash('sha256')
      .update(token)
      .digest()

    const result = await pool.query(
      `SELECT
          admin_users.id,
          admin_users.email
       FROM admin_sessions
       JOIN admin_users
         ON admin_sessions.admin_id = admin_users.id
       WHERE admin_sessions.token_hash = $1
         AND admin_sessions.expires_at > NOW()
         AND admin_users.is_active = TRUE`,
      [tokenHash]
    )

    if (result.rows.length === 0) {
      res.clearCookie(
        SESSION_COOKIE,
        getCookieOptions()
      )

      return res.status(401).json({
        message: 'Your administrator session is invalid or expired.',
      })
    }

    req.admin = result.rows[0]

    next()
  } catch (error) {
    console.error('Admin authentication error:', error.message)

    return res.status(500).json({
      message: 'Unable to verify administrator access.',
    })
  }
}

module.exports = {
  requireAdmin,
  SESSION_COOKIE,
  getCookieOptions,
  getCookie,
}