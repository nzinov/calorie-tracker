#!/usr/bin/env node
const { execSync } = require('node:child_process')

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

if (process.env.PRISMA_SKIP_POSTINSTALL_GENERATE) {
  console.log('[prisma-generate] Skipping due to PRISMA_SKIP_POSTINSTALL_GENERATE')
  process.exit(0)
}

const url = process.env.DATABASE_URL || ''
const isPostgres = url.startsWith('postgresql://') || process.env.NODE_ENV === 'production'
const schema = isPostgres ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma'

console.log(`[prisma-generate] Using schema: ${schema}`)
run(`npx prisma generate --schema ${schema}`)
