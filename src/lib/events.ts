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

// What a change invalidated. Events carry no payload: the client refetches the
// affected resource, which is the same authoritative path it uses on load. That
// makes replay idempotent - N events collapse into one refetch - and removes the
// client-side merge that used to splice payloads into local state.
export type DataChange = {
  day?: boolean    // the daily log for targetDate changed
  foods?: boolean  // the user's food database changed
}

// Normalise a day the same way every write path does, so a food entry and the
// chat session for its day agree on the value.
export function startOfDay(value: Date | string) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

// Format a day as the YYYY-MM-DD string the client compares against. Dates are
// normalised in server-local time, so read the local components back rather than
// going through toISOString(), which can land on the previous day.
function toDateString(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Record a change on the chat session for the day it affects, so every client
// streaming that day learns to refetch.
export async function recordDataChange(userId: string, date: Date | string, changed: DataChange) {
  try {
    const day = startOfDay(date)
    const chatSession = await withRetry(() => db.chatSession.findUnique({
      where: { userId_date: { userId, date: day } },
      select: { id: true }
    }))
    // No session for that day means no stream is listening for it.
    if (!chatSession) return
    await createChatEvent(chatSession.id, 'data_changed', {
      type: 'data_changed',
      targetDate: toDateString(day),
      changed
    })
  } catch (e) {
    // Never let event recording fail the mutation that triggered it
    console.error('Failed to record data change', e)
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

