import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getChatEventsSince } from "@/lib/events"

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const chatSessionId = searchParams.get('chatSessionId') || ''
  // Default since to now-2s to minimize race on first connect
  const sinceDefault = new Date(Date.now() - 2000).toISOString()
  let since = searchParams.get('since') || sinceDefault

  const session = await getServerSession(authOptions)
  if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!chatSessionId) {
    return new Response('chatSessionId is required', { status: 400 })
  }

  const encoder = new TextEncoder()
  let open = true

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          return true
        } catch {
          open = false
          return false
        }
      }

      while (open) {
        if ((request as any).signal?.aborted) break
        try {
          const events = await getChatEventsSince(chatSessionId, since, 200)
          if (events.length > 0) {
            for (const ev of events) {
              try {
                const payload = JSON.parse(ev.payload)
                // Attach lightweight metadata for robust client-side resuming
                // and deduplication without changing existing consumer logic.
                ;(payload as any)._ts = ev.createdAt.toISOString()
                ;(payload as any)._eventId = ev.id
                send(payload)
                // Move cursor forward per-event to avoid duplicates if streaming throws
                since = ev.createdAt.toISOString()
              } catch {}
            }
          }
        } catch (e) {
          send({ type: 'error', error: 'Failed to fetch events' })
        }
        await sleep(250)
      }

      try { controller.close() } catch {}
    },
    cancel() { open = false }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
