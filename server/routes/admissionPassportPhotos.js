
const express = require('express')
const multer = require('multer')
const { createHash, randomUUID } = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')

const pool = require('../db')

const router = express.Router()

const APPLICATION_FEE_KOBO = 1000000
const BUCKET_NAME = 'admission-passports'
const MAX_FILE_SIZE = 5 * 1024 * 1024

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

let supabaseClient = null

function getSupabaseClient() {
  if (!process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Supabase storage configuration is missing.')
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    )
  }

  return supabaseClient
}

async function removeStoredPhoto(supabase, path) {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path])

    if (error) {
      console.error('Passport photograph cleanup error:', error.message)
    }
  } catch (error) {
    console.error('Passport photograph cleanup error:', error.message)
  }
}

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 1,
    parts: 2,
  },

  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error('Only JPEG, PNG and WebP photographs are allowed.')
      )
    }

    callback(null, true)
  },
})// Verify payment access before processing an uploaded photograph.
async function requirePaymentAccess(req, res, next) {
  const authorization = req.get('authorization') || ''

  const match = authorization.match(
    /^Bearer\s+([A-Za-z0-9_-]{40,60})$/i
  )

  if (!match) {
    return res.status(401).json({
      message: 'Valid application payment access is required.',
    })
  }

  const accessTokenHash = createHash('sha256')
    .update(match[1])
    .digest('hex')

  try {
    const paymentResult = await pool.query(
      `SELECT id
       FROM public.admission_payments
       WHERE access_token_hash = $1
         AND status = 'success'
         AND amount_kobo = $2
         AND currency = 'NGN'
         AND access_expires_at > NOW()
         AND access_used_at IS NULL`,
      [accessTokenHash, APPLICATION_FEE_KOBO]
    )

    if (paymentResult.rows.length === 0) {
      return res.status(401).json({
        message: 'Payment access is invalid, expired, or already used.',
      })
    }

    req.accessTokenHash = accessTokenHash

    return next()

  } catch (error) {
    console.error(
      'Passport upload payment verification error:',
      error.message
    )

    return res.status(503).json({
      message: 'Unable to verify application payment access.',
    })
  }
}

function identifyImage(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      mimeType: 'image/jpeg',
      extension: 'jpg',
    }
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return {
      mimeType: 'image/png',
      extension: 'png',
    }
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return {
      mimeType: 'image/webp',
      extension: 'webp',
    }
  }

  return null
}

// Upload a passport photograph after payment verification.
router.post('/upload', requirePaymentAccess, (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (error) {
      const status =
        error.code === 'LIMIT_FILE_SIZE' ? 413 : 400

      return res.status(status).json({
        message:
          status === 413
            ? 'The passport photograph must not exceed 5 MB.'
            : error.message,
      })
    }

    next()
  })
}, async (req, res) => {


  if (!req.file) {
    return res.status(400).json({
      message: 'Please select a passport photograph.',
    })
  }

  const image = identifyImage(req.file.buffer)

  if (!image || image.mimeType !== req.file.mimetype) {
    return res.status(400).json({
      message: 'The uploaded file is not a valid supported image.',
    })
  }

    const accessTokenHash = req.accessTokenHash

  let client = null
  let transactionOpen = false
  let commitAttempted = false
  let supabase = null
  let uploadedPath = null
  let oldPath = null

  try {
    client = await pool.connect()

    await client.query('BEGIN')
    transactionOpen = true

    // Lock the payment record while the upload is processed.
    const paymentResult = await client.query(
      `SELECT
          id,
          passport_photo_path
       FROM public.admission_payments
       WHERE access_token_hash = $1
         AND status = 'success'
         AND amount_kobo = $2
         AND currency = 'NGN'
         AND access_expires_at > NOW()
         AND access_used_at IS NULL
       FOR UPDATE`,
      [accessTokenHash, APPLICATION_FEE_KOBO]
    )

    const payment = paymentResult.rows[0]

    if (!payment) {
      await client.query('ROLLBACK')
      transactionOpen = false

      return res.status(401).json({
        message: 'Payment access is invalid, expired, or already used.',
      })
    }

    oldPath = payment.passport_photo_path

    supabase = getSupabaseClient()

    uploadedPath =
      `applications/${payment.id}/${randomUUID()}.${image.extension}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uploadedPath, req.file.buffer, {
        contentType: image.mimeType,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      const error = new Error('Unable to store the passport photograph securely.')
      error.statusCode = 502
      throw error
    }

    const updateResult = await client.query(
      `UPDATE public.admission_payments
       SET
          passport_photo_path = $1,
          updated_at = NOW()
       WHERE id = $2
         AND access_token_hash = $3
         AND status = 'success'
         AND amount_kobo = $4
         AND currency = 'NGN'
         AND access_expires_at > clock_timestamp()
         AND access_used_at IS NULL
       RETURNING id`,
      [
        uploadedPath,
        payment.id,
        accessTokenHash,
        APPLICATION_FEE_KOBO,
      ]
    )

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK')
      transactionOpen = false

      await removeStoredPhoto(supabase, uploadedPath)
      uploadedPath = null

      return res.status(401).json({
        message: 'Payment access is invalid, expired, or already used.',
      })
    }

    commitAttempted = true
    await client.query('COMMIT')
    transactionOpen = false

    // Remove the old photograph only after the new path is saved.
    if (
      oldPath &&
      oldPath.startsWith(`applications/${payment.id}/`) &&
      oldPath !== uploadedPath
    ) {
      await removeStoredPhoto(supabase, oldPath)
    }

    return res.status(201).json({
      message: 'Passport photograph uploaded securely.',
      data: {
        uploaded: true,
      },
    })

  } catch (error) {
    if (transactionOpen && client) {
      await client.query('ROLLBACK').catch(() => {})
    }

    // Do not delete a new photograph when the commit result
    // is uncertain, because the database may have saved its path.
    if (uploadedPath && supabase && !commitAttempted) {
      await removeStoredPhoto(supabase, uploadedPath)
    }

    console.error(
      'Passport photograph upload error:',
      error.message
    )

    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode === 502
          ? error.message
          : 'Unable to upload the passport photograph.',
    })

  } finally {
    if (client) {
      client.release()
    }
  }
})

module.exports = router
