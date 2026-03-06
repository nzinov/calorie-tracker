export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (error) => {
      console.error('[CRASH] Uncaught Exception:', error.stack || error)
      process.exit(1)
    })

    process.on('unhandledRejection', (reason) => {
      console.error('[CRASH] Unhandled Rejection:', reason instanceof Error ? reason.stack : reason)
      process.exit(1)
    })
  }
}
