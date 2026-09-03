"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

// Which day the app is showing, plus the single event stream for it.
//
// The stream used to live inside ChatInterface, which is mounted twice (mobile and
// desktop), so every user opened two connections and every event was handled twice.
// One connection lives here and fans out to whoever subscribes.

export type DayEvent = {
  type: string
  [key: string]: any
}

type DayEventsValue = {
  date: string
  setDate: (date: string) => void
  chatSessionId: string | null
  initialMessages: any[]
  subscribe: (handler: (evt: DayEvent) => void) => () => void
}

const DayEventsContext = createContext<DayEventsValue | null>(null)

export function useDayEvents() {
  const ctx = useContext(DayEventsContext)
  if (!ctx) throw new Error("useDayEvents must be used within DayEventsProvider")
  return ctx
}

// Subscribe to events of one type for the life of the component.
export function useDayEvent(type: string, handler: (evt: DayEvent) => void) {
  const { subscribe } = useDayEvents()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    return subscribe(evt => {
      if (evt.type === type) handlerRef.current(evt)
    })
  }, [subscribe, type])
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function DayEventsProvider({ children }: { children: React.ReactNode }) {
  const [date, setDate] = useState<string>(getTodayDateString)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<any[]>([])

  const handlersRef = useRef<Set<(evt: DayEvent) => void>>(new Set())

  const subscribe = useCallback((handler: (evt: DayEvent) => void) => {
    handlersRef.current.add(handler)
    return () => { handlersRef.current.delete(handler) }
  }, [])

  const emit = useCallback((evt: DayEvent) => {
    handlersRef.current.forEach(h => {
      try { h(evt) } catch (e) { console.error("Day event handler failed", e) }
    })
  }, [])

  // Auto-switch to today when a new day has started while the app was open.
  const lastKnownTodayRef = useRef<string>(getTodayDateString())
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const today = getTodayDateString()
      if (today !== lastKnownTodayRef.current) {
        lastKnownTodayRef.current = today
        setDate(today)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Resolve the chat session for the selected day, creating one if needed.
  useEffect(() => {
    let cancelled = false
    setChatSessionId(null)
    setInitialMessages([])

    const load = async () => {
      try {
        const res = await fetch(`/api/chat-sessions?date=${encodeURIComponent(date)}`)
        if (res.ok) {
          const sessions = await res.json()
          if (sessions.length > 0) {
            if (cancelled) return
            setChatSessionId(sessions[0].id)
            setInitialMessages(sessions[0].messages ?? [])
            return
          }
        }
        const created = await fetch(`/api/chat-sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        })
        if (!created.ok || cancelled) return
        const session = await created.json()
        if (cancelled) return
        setChatSessionId(session.id)
        setInitialMessages(session.messages ?? [])
      } catch (e) {
        console.error("Failed to load chat session", e)
      }
    }

    load()
    return () => { cancelled = true }
  }, [date])

  // One SSE connection for the session, reconnecting with backoff.
  useEffect(() => {
    if (!chatSessionId) return

    let cancelled = false
    let controller: AbortController | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    // History arrived over REST above, so the stream only needs events from now
    // on. The small buffer covers the gap before this connection opens.
    let since = new Date(Date.now() - 2000).toISOString()
    const seen = new Set<string>()

    const read = async (response: Response) => {
      const reader = response.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split("\n\n")
        buffer = chunks.pop() || ""
        for (const chunk of chunks) {
          const line = chunk.trim()
          if (!line.startsWith("data:")) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          try {
            const evt = JSON.parse(payload) as DayEvent
            if (typeof evt._ts === 'string') since = evt._ts
            const id = evt._eventId as string | undefined
            if (id) {
              if (seen.has(id)) continue
              seen.add(id)
              if (seen.size > 1000) {
                const oldest = seen.values().next().value
                if (oldest) seen.delete(oldest)
              }
            }
            emit(evt)
          } catch {}
        }
      }
    }

    const connect = async () => {
      if (cancelled) return
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
      controller = new AbortController()
      try {
        const res = await fetch(
          `/api/chat/events/stream?chatSessionId=${encodeURIComponent(chatSessionId)}&since=${encodeURIComponent(since)}`,
          { signal: controller.signal }
        )
        if (!res.ok || !res.body) throw new Error("Bad SSE response")
        attempt = 0
        await read(res)
      } catch {
        // fall through to reconnect
      }
      if (cancelled) return
      reconnectTimeout = setTimeout(connect, Math.min(1000 * Math.pow(2, attempt++), 15000))
    }

    // Reconnect immediately when the tab becomes visible to catch missed events.
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      try { controller?.abort() } catch {}
      attempt = 0
      connect()
    }

    document.addEventListener('visibilitychange', onVisible)
    connect()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      try { controller?.abort() } catch {}
    }
  }, [chatSessionId, emit])

  return (
    <DayEventsContext.Provider value={{ date, setDate, chatSessionId, initialMessages, subscribe }}>
      {children}
    </DayEventsContext.Provider>
  )
}
