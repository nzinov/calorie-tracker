"use client"

import { useEffect, useRef, useState } from "react"

interface ChatMessage {
  id?: string
  role: "user" | "assistant" | "tool"
  content: string | null
  toolCalls?: string | null
  toolCallId?: string | null
}

type DataUpdate = {
  foodEntries?: any[]
  totals?: any
  foodAdded?: any
  foodUpdated?: any
  foodDeleted?: string
  refetch?: boolean
}

interface ChatInterfaceProps {
  currentTotals?: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
  foodEntries?: any[]
  onDataUpdate?: (update: DataUpdate) => void
  date?: string
}

export function ChatInterface({ currentTotals, foodEntries, onDataUpdate, date }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const [hasLoadedInitialMessages, setHasLoadedInitialMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, processingSteps])

  const getToolResultsForMessage = (assistantMessage: ChatMessage, allMessages: ChatMessage[]): string[] => {
    if (!assistantMessage.toolCalls) return []
    try {
      const toolCalls = JSON.parse(assistantMessage.toolCalls)
      const toolCallIds = toolCalls.map((c: any) => c.id)
      const results: string[] = []
      allMessages.forEach((m) => {
        if (m.role === "tool" && m.toolCallId && toolCallIds.includes(m.toolCallId) && m.content) {
          results.push(m.content)
        }
      })
      return results
    } catch (e) {
      console.error("Failed to parse tool calls", e)
      return []
    }
  }

  const loadMessages = async () => {
    if (!chatSessionId) return
    try {
      const params = date ? `?date=${date}` : ""
      const res = await fetch(`/api/chat-sessions${params}`)
      if (!res.ok) return
      const sessions = await res.json()
      if (sessions.length > 0) {
        const session = sessions[0]
        const serverMessages: ChatMessage[] = session.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          toolCallId: m.toolCallId,
        }))
        setMessages(serverMessages)
        setHasLoadedInitialMessages(true)
      }
    } catch (e) {
      console.error("Failed to load messages", e)
    }
  }

  useEffect(() => {
    // Reset when date changes
    setHasLoadedInitialMessages(false)
    setMessages([])
    loadChatSession()
  }, [date])

  useEffect(() => {
    if (chatSessionId && !hasLoadedInitialMessages) {
      loadMessages()
    }
  }, [chatSessionId, hasLoadedInitialMessages])

  const loadChatSession = async () => {
    try {
      const params = date ? `?date=${date}` : ""
      const res = await fetch(`/api/chat-sessions${params}`)
      if (res.ok) {
        const sessions = await res.json()
        if (sessions.length > 0) {
          setChatSessionId(sessions[0].id)
          return
        }
      }
      await createNewChatSession()
    } catch (e) {
      console.error("Failed to load chat session", e)
      await createNewChatSession()
    }
  }

  const createNewChatSession = async () => {
    try {
      const res = await fetch(`/api/chat-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      })
      if (res.ok) {
        const session = await res.json()
        setChatSessionId(session.id)
        if (session.messages) {
          setMessages(
            session.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              toolCalls: m.toolCalls,
              toolCallId: m.toolCallId,
            }))
          )
          setHasLoadedInitialMessages(true)
        }
      }
    } catch (e) {
      console.error("Failed to create chat session", e)
    }
  }

  const parseStream = async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) return
    const decoder = new TextDecoder()
    let buffer = ""
    try {
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
            const evt = JSON.parse(payload)
            if (evt.type === "status" && evt.message) {
              setProcessingSteps(prev => [...prev, evt.message])
            }
            if (evt.type === "message" && evt.message) {
              setMessages(prev => [...prev, evt.message as ChatMessage])
            }
            if (evt.type === "data_changed" && evt.data) {
              if (evt.data.foodAdded && onDataUpdate) {
                onDataUpdate({ foodAdded: evt.data.foodAdded })
              } else if ((evt.data.foodUpdated || evt.data.foodDeleted) && onDataUpdate) {
                onDataUpdate({ refetch: true })
              }
            }
            if (evt.type === "completed") {
              setLoading(false)
              setProcessingSteps([])
            }
            if (evt.type === "error") {
              setLoading(false)
              setProcessingSteps([])
              console.error("Stream error:", evt.error)
            }
          } catch (e) {
            console.error("Failed to parse event", e)
          }
        }
      }
    } finally {
      try { reader.releaseLock() } catch {}
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setProcessingSteps(["Thinking..."])
    setMessages(prev => [...prev, { role: "user", content: text } as ChatMessage])
    setInput("")
    try {
      const res = await fetch(`/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chatSessionId,
          totals: currentTotals,
          foodEntries,
          date,
        }),
      })
      if (!res.ok) {
        setLoading(false)
        setProcessingSteps([])
        console.error("Failed to send message")
        return
      }
      await parseStream(res)
    } catch (e) {
      setLoading(false)
      setProcessingSteps([])
      console.error("Failed to send message", e)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 md:p-4 h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.map((message, index) => {
          return (
            <div key={index}>
              <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="flex items-start gap-2 max-w-2xl">
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      message.role === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-900"
                    }`}
                  >
                    {message.content && <p className="text-xs md:text-sm whitespace-pre-wrap">{message.content}</p>}
                  </div>
                </div>
              </div>

              {message.role === "assistant" && message.toolCalls && (
                <div className="flex justify-start mt-2">
                  <div className="flex flex-wrap gap-2 max-w-2xl">
                    {getToolResultsForMessage(message, messages).map((toolResult, i) => {
                      const getActionIcon = (text: string) => {
                        const t = text.toLowerCase()
                        if (t.includes("added")) return "✅"
                        if (t.includes("updated")) return "✏️"
                        if (t.includes("deleted")) return "🗑️"
                        if (t.includes("error")) return "❌"
                        return "📝"
                      }
                      const getActionColor = (text: string) => {
                        const t = text.toLowerCase()
                        if (t.includes("error")) return "border-red-300 bg-red-100 text-red-800"
                        if (t.includes("deleted")) return "border-orange-300 bg-orange-100 text-orange-800"
                        if (t.includes("updated")) return "border-blue-300 bg-blue-100 text-blue-800"
                        return "border-emerald-300 bg-emerald-100 text-emerald-800"
                      }
                      return (
                        <span
                          key={i}
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${getActionColor(toolResult)}`}
                        >
                          <span className="mr-1.5">{getActionIcon(toolResult)}</span>
                          {toolResult}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {processingSteps.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2 rounded-lg">
              {processingSteps.map((step, idx) => (
                <p key={idx} className="text-xs md:text-sm">{step}</p>
              ))}
              {loading && (
                <div className="flex items-center mt-1">
                  <div className="animate-pulse flex space-x-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex space-x-2 mt-3 md:mt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Try: I had chicken and rice..."
          className="flex-1 border border-gray-400 rounded-lg px-3 py-2 text-sm md:text-base text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-500 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  )
}

