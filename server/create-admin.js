require('dotenv').config()

const { randomBytes, scrypt } = require('node:crypto')
const { promisify } = require('node:util')
const pool = require('./db')

const scryptAsync = promisify(scrypt)

async function createAdmin() {
  const email = (process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase()

  const password = process.env.ADMIN_PASSWORD || ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please provide a valid administrator email.')
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error(
      'The administrator password must contain 12 to 128 characters.'
    )
  }

  const salt = randomBytes(16)

  const passwordHash = await scryptAsync(
    password,
    salt,
    64
  )

  const result = await pool.query(
    `INSERT INTO admin_users
      (email, password_salt, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, created_at`,
    [email, salt, passwordHash]
  )

  console.log('Administrator account created successfully.')
  console.log(result.rows[0])
}

createAdmin()
  .catch((error) => {
    if (error.code === '23505') {
      console.error('An administrator with this email already exists.')
    } else {
      console.error('Administrator creation failed:', error.message)
    }

    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })