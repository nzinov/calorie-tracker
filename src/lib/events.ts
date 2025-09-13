import { db } from "@/lib/db"

export type ChatEventType = 'status' | 'message' | 'data_changed' | 'error' | 'completed'

export async function createChatEvent(chatSessionId: string, type: ChatEventType, payload: any) {
  try {
    await db.chatEvent.create({
      data: {
        chatSessionId,
        type,
        payload: JSON.stringify(payload)
      }
    })
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
    const rows = await db.chatEvent.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit
    })
    return rows
  } catch (e) {
    console.error('Failed to fetch chat events', e)
    return []
  }
}

