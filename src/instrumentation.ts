// Prisma error codes that are transient/recoverable (don't crash the process)
const RECOVERABLE_PRISMA_ERRORS = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server was reached but timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a new connection from the pool
])

function isRecoverableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const code = (error as any).code
    if (typeof code === 'string' && RECOVERABLE_PRISMA_ERRORS.has(code)) {
      return true
    }
  }
  return false
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (error) => {
      if (isRecoverableError(error)) {
        console.error('[RECOVERABLE] Uncaught Exception (not crashing):', error.stack || error)
        return
      }
      console.error('[CRASH] Uncaught Exception:', error.stack || error)
      process.exit(1)
    })

    process.on('unhandledRejection', (reason) => {
      if (isRecoverableError(reason)) {
        console.error('[RECOVERABLE] Unhandled Rejection (not crashing):', reason instanceof Error ? reason.stack : reason)
        return
      }
      console.error('[CRASH] Unhandled Rejection:', reason instanceof Error ? reason.stack : reason)
      process.exit(1)
    })
  }
}
