import { db } from "@/lib/db"

export type ChatEventType = 'status' | 'message' | 'data_changed' | 'error' | 'completed'

// Prisma error codes that are transient and worth retrying
const TRANSIENT_PRISMA_ERRORS = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server was reached but timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a new connection from the pool
])

function isTransientError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const code = (error as any).code
    return typeof code === 'string' && TRANSIENT_PRISMA_ERRORS.has(code)
  }
  return false
}

async function withRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 2, delayMs = 500 }: { maxRetries?: number; delayMs?: number } = {}
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (!isTransientError(e) || attempt === maxRetries) {
        throw e
      }
      // Wait before retry with exponential backoff
      await new Promise(res => setTimeout(res, delayMs * (attempt + 1)))
    }
  }
  throw lastError
}

export async function createChatEvent(chatSessionId: string, type: ChatEventType, payload: any) {
  try {
    await withRetry(() => db.chatEvent.create({
      data: {
        chatSessionId,
        type,
        payload: JSON.stringify(payload)
      }
    }))
  } catch (e) {
    // Do not throw to avoid interrupting processing pipeline
    console.error('Failed to create chat event', e)
  }
}

export async function getChatEventsSince(chatSessionId: string, sinceIso?: string, limit = 100) {
  const where: any = { chatSessionId }
  if (sinceIso) {
    where.createdAt = { gt: new Date(sinceIso) }
  }
  try {
    const rows = await withRetry(() => db.chatEvent.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit
    }))
    return rows
  } catch (e) {
    console.error('Failed to fetch chat events', e)
    return []
  }
}

