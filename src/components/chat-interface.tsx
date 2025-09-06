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
    salt: number
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
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Compress image to keep the request payload small (< ~900KB)
  const compressImageToDataUrl = async (file: File): Promise<string> => {
    const MAX_SIDE = 1280
    const TARGET_BYTES = 900 * 1024
    const MIN_QUALITY = 0.5

    const loadImage = (file: File): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve(img)
        }
        img.onerror = (e) => {
          URL.revokeObjectURL(url)
          reject(e)
        }
        img.src = url
      })
    }

    const img = await loadImage(file)
    let width = img.width
    let height = img.height
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
    width = Math.round(width * scale)
    height = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)

    let quality = 0.8
    let dataUrl = canvas.toDataURL('image/jpeg', quality)
    let byteLength = Math.ceil((dataUrl.length * 3) / 4) // rough estimate

    // Try decreasing quality to meet target size
    while (byteLength > TARGET_BYTES && quality > MIN_QUALITY) {
      quality -= 0.1
      dataUrl = canvas.toDataURL('image/jpeg', quality)
      byteLength = Math.ceil((dataUrl.length * 3) / 4)
    }

    return dataUrl
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, processingSteps])

  // Adjust bottom padding when the on-screen keyboard appears on mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).visualViewport) return
    const vv: VisualViewport = (window as any).visualViewport
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
      if (rootRef.current) {
        rootRef.current.style.setProperty('--kb-inset', `${Math.round(inset)}px`)
      }
    }
    vv.addEventListener('resize', updateInset)
    vv.addEventListener('scroll', updateInset)
    updateInset()
    return () => {
      vv.removeEventListener('resize', updateInset)
      vv.removeEventListener('scroll', updateInset)
    }
  }, [])

  const getToolResultsForMessage = (assistantMessage: ChatMessage, allMessages: ChatMessage[]): string[] => {
    if (!assistantMessage.toolCalls) return []
    try {
      const toolCalls = JSON.parse(assistantMessage.toolCalls)
      const toolCallIds: string[] = toolCalls.map((c: any) => c.id)
      const wanted = new Set(toolCallIds)
      const seenIds = new Set<string>()
      const results: string[] = []
      for (const m of allMessages) {
        if (m.role !== "tool") continue
        if (!m.toolCallId) continue
        if (!wanted.has(m.toolCallId)) continue
        if (seenIds.has(m.toolCallId)) continue
        if (!m.content) continue
        seenIds.add(m.toolCallId)
        results.push(m.content)
      }
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
              const incoming = evt.message as ChatMessage
              setMessages(prev => {
                if (incoming.role === 'user') {
                  for (let i = prev.length - 1; i >= 0; i--) {
                    const pm = prev[i]
                    if (pm.role === 'user' && pm.content === incoming.content && !pm.id) {
                      const copy = prev.slice()
                      copy[i] = incoming
                      return copy
                    }
                  }
                }
                if (incoming.role === 'tool' && incoming.toolCallId) {
                  // Avoid duplicate tool messages for the same tool call id
                  for (let i = prev.length - 1; i >= 0; i--) {
                    const pm = prev[i]
                    if (pm.role === 'tool' && pm.toolCallId === incoming.toolCallId) {
                      const copy = prev.slice()
                      copy[i] = incoming
                      return copy
                    }
                  }
                }
                return [...prev, incoming]
              })
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
              const lines: string[] = []
              const errText = typeof evt.error === 'string' ? evt.error : 'Unexpected error'
              lines.push(`Error: ${errText}`)
              const provider = typeof evt.providerError === 'string' ? evt.providerError : null
              if (provider) lines.push(`Details: ${provider}`)
              if (!provider && evt.details) {
                try {
                  const raw = typeof evt.details === 'string' ? evt.details : JSON.stringify(evt.details)
                  const short = raw.length > 500 ? raw.slice(0, 500) + '…' : raw
                  lines.push(`Details: ${short}`)
                } catch {}
              }
              setProcessingSteps(lines)
              console.error("Stream error:", evt.error, evt.providerError || '', evt.details || '')
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
    if ((text.length === 0 && !imageDataUrl) || loading) return
    setLoading(true)
    // Show only the typing dots (no text)
    setProcessingSteps([])
    const fallbackText = "Please analyze the attached photo and extract foods and nutrition."
    const placeholder = imageDataUrl
      ? `${text.length > 0 ? text : fallbackText}\n[Image attached]`
      : text
    setMessages(prev => [...prev, { role: "user", content: placeholder } as ChatMessage])
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
          imageDataUrl,
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
    // Clear selected image after sending
    setImageDataUrl(null)
    setImageName(null)
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
          // Hide raw tool messages; show their results only as pills under the assistant message
          if (message.role === "tool") return null
          return (
            <div key={index}>
              {!(message.role === 'assistant' && (!message.content || message.content.trim().length === 0)) && (
                <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="flex items-start gap-2 max-w-2xl">
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        message.role === "user"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-900"
                      }`}
                    >
                      {message.content && <p className="text-xs md:text-sm whitespace-pre-wrap break-words">{message.content}</p>}
                    </div>
                  </div>
                </div>
              )}

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

        {(loading || processingSteps.length > 0) && (
          <div className="flex justify-start">
            <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2 rounded-lg">
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-pulse flex space-x-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
              ) : (
                processingSteps.map((step, idx) => (
                  <p key={idx} className="text-xs md:text-sm">{step}</p>
                ))
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex space-x-2 mt-3 md:mt-4">
        <div className="flex items-center">
          <label className="cursor-pointer inline-flex items-center px-2 py-2 border border-gray-400 rounded-lg text-xs md:text-sm text-gray-800 hover:bg-gray-50">
            📷 
            <input
              type="file"
              // Use both capture attribute and the accept hint variant for broader Android support
              accept="image/*;capture=environment"
              capture="environment"
              // Avoid display:none to improve mobile compatibility (especially iOS)
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setImageName(file.name)
                try {
                  const dataUrl = await compressImageToDataUrl(file)
                  setImageDataUrl(dataUrl)
                } catch (err) {
                  console.error('Failed to process image', err)
                  alert('Failed to process the image. Please try another file.')
                  e.currentTarget.value = ""
                }
              }}
              disabled={loading}
            />
          </label>
        </div>
        <input
          type="text"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            // Ensure the input remains visible above the keyboard
            setTimeout(() => {
              try {
                inputRef.current?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
                messagesEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
              } catch {}
            }, 0)
          }}
          placeholder="Try: I had chicken and rice..."
          className="flex-1 border border-gray-400 rounded-lg px-3 py-2 text-sm md:text-base text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && !imageDataUrl)}
          className="bg-blue-500 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>

      {imageDataUrl && (
        <div className="mt-2 flex items-center gap-2">
          <img src={imageDataUrl} alt="Selected" className="h-16 w-16 object-cover rounded border" />
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={() => {
              setImageDataUrl(null)
              setImageName(null)
            }}
          >
            Remove photo
          </button>
        </div>
      )}
    </div>
  )
}
