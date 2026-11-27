require('dotenv').config({ path: require('node:path').join(__dirname, '.env') })

const fs = require('node:fs')
const path = require('node:path')
const pool = require('./db')

async function main() {
  try {
    const migrationPath = path.join(
      __dirname,
      'migrations',
      '008_admission_enquiry_archiving.sql'
    )

    const sql = fs.readFileSync(migrationPath, 'utf8')

    await pool.query(sql)

    console.log('Migration 008 applied successfully.')
  } catch (error) {
    console.error('Migration 008 failed:', error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
