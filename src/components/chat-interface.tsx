"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Fuse from "fuse.js"
import { MarkdownRenderer } from "./markdown-renderer"

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

export interface UserFood {
  id: string
  name: string
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
  saltPer100g: number
  defaultGrams: number | null
  comments: string | null
}

interface ChatInterfaceProps {
  onDataUpdate?: (update: DataUpdate) => void
  date: string
  userFoods?: UserFood[]
  onQuickAdd?: (entry: { userFoodId: string; grams: number }) => Promise<void>
  onUserFoodCreated?: () => void
}

export function ChatInterface({ onDataUpdate, date, userFoods = [], onQuickAdd, onUserFoodCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const [hasLoadedInitialMessages, setHasLoadedInitialMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [, setImageName] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Quick-add state
  const [selectedFood, setSelectedFood] = useState<UserFood | null>(null)
  const [quickAddGrams, setQuickAddGrams] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [quickAdding, setQuickAdding] = useState(false)
  const gramsInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fuzzy search for quick-add
  const fuse = useMemo(() => {
    return new Fuse(userFoods, {
      keys: ['name', 'comments'],
      threshold: 0.4,
      includeScore: true,
    })
  }, [userFoods])

  const searchResults = useMemo(() => {
    if (!input.trim() || selectedFood) return []
    const results = fuse.search(input)
    return results.slice(0, 6).map(r => r.item)
  }, [fuse, input, selectedFood])

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
    const el = messagesContainerRef.current
    if (el) {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      } catch {
        el.scrollTop = el.scrollHeight
      }
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, processingSteps])

  // On initial page load, scroll the chat section into view
  useEffect(() => {
    setTimeout(() => {
      try {
        chatRef.current?.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'smooth' })
      } catch {}
    }, 300)
  }, [])

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

  // Ensure video element attaches to stream after modal renders
  useEffect(() => {
    if (!cameraOpen) return
    const v = videoRef.current
    const s = streamRef.current
    if (v && s) {
      try { (v as any).srcObject = s } catch {}
      ;(async () => { try { await v.play() } catch {} })()
    }
    return () => {
      if (v) {
        try { (v as any).srcObject = null } catch {}
      }
    }
  }, [cameraOpen])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
      streamRef.current = null
      if (videoRef.current) {
        try { (videoRef.current as any).srcObject = null } catch {}
      }
    }
  }, [])

  // Prefer camera on Android when available
  const isAndroid = () => {
    if (typeof navigator === 'undefined') return false
    return /Android/i.test(navigator.userAgent)
  }

  const openCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        fileInputRef.current?.click()
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        try { (videoRef.current as any).srcObject = stream } catch {}
        try { await videoRef.current.play() } catch {}
      }
      setCameraOpen(true)
    } catch (err) {
      console.error('Failed to open camera', err)
      fileInputRef.current?.click()
    }
  }

  const closeCamera = () => {
    try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
    streamRef.current = null
    if (videoRef.current) {
      try { (videoRef.current as any).srcObject = null } catch {}
    }
    setCameraOpen(false)
  }

  // Wait until video has non-zero dimensions (up to a short timeout)
  const waitForVideoDimensions = async (video: HTMLVideoElement, timeoutMs = 3000) => {
    if (video.videoWidth && video.videoHeight) return
    const start = Date.now()
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (video.videoWidth && video.videoHeight) return resolve()
        if (Date.now() - start > timeoutMs) return resolve()
        requestAnimationFrame(tick)
      }
      tick()
    })
  }

  const capturePhotoFromStream = async () => {
    const video = videoRef.current
    if (!video) return
    // Wait for metadata so dimensions are available
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        const handler = () => { resolve(); video.removeEventListener('loadedmetadata', handler) }
        video.addEventListener('loadedmetadata', handler)
      })
    }
    await waitForVideoDimensions(video)
    const vw = video.videoWidth || 0
    const vh = video.videoHeight || 0

    // Fallback to ImageCapture API if available and dimensions still zero
    if ((!vw || !vh) && streamRef.current) {
      try {
        const track = streamRef.current.getVideoTracks()[0]
        const ImageCaptureCtor = (window as any).ImageCapture
        if (track && ImageCaptureCtor) {
          const ic = new ImageCaptureCtor(track)
          const blob: Blob = await ic.takePhoto()
          const file = new File([blob], 'camera.jpg', { type: blob.type || 'image/jpeg' })
          const dataUrl = await compressImageToDataUrl(file)
          setImageDataUrl(dataUrl)
          setImageName('camera.jpg')
          closeCamera()
          return
        }
      } catch (e) {
        console.warn('ImageCapture fallback failed', e)
      }
    }

    if (!vw || !vh) {
      alert('Camera not ready. Please try capturing again.')
      return
    }
    const MAX_SIDE = 1280
    const TARGET_BYTES = 900 * 1024
    const MIN_QUALITY = 0.5
    const scale = Math.min(1, MAX_SIDE / Math.max(vw, vh))
    const width = Math.round(vw * scale)
    const height = Math.round(vh * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, width, height)
    let quality = 0.8
    let dataUrl = canvas.toDataURL('image/jpeg', quality)
    let byteLength = Math.ceil((dataUrl.length * 3) / 4)
    while (byteLength > TARGET_BYTES && quality > MIN_QUALITY) {
      quality -= 0.1
      dataUrl = canvas.toDataURL('image/jpeg', quality)
      byteLength = Math.ceil((dataUrl.length * 3) / 4)
    }
    setImageDataUrl(dataUrl)
    setImageName('camera.jpg')
    closeCamera()
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

  // Maintain a live SSE connection that streams new events from DB
  useEffect(() => {
    let cancelled = false
    let controller: AbortController | null = null
    const lastTsRef = { current: null as string | null }
    const attemptRef = { current: 0 }

    const connect = async () => {
      if (!chatSessionId || cancelled) return
      controller = new AbortController()
      const since = (lastTsRef.current || new Date(Date.now() - 2000).toISOString())
      try {
        const res = await fetch(
          `/api/chat/events/stream?chatSessionId=${encodeURIComponent(chatSessionId)}&since=${encodeURIComponent(since)}`,
          { signal: controller.signal }
        )
        if (!res.ok || !res.body) throw new Error('Bad SSE response')
        attemptRef.current = 0 // reset backoff on successful connect
        await parseStream(res, (ts) => { lastTsRef.current = ts })
        // If stream finishes without error (e.g., network change), reconnect
        if (!cancelled) {
          const delay = Math.min(1000 * Math.pow(2, attemptRef.current++), 15000)
          setTimeout(connect, delay)
        }
      } catch (_) {
        if (cancelled) return
        const delay = Math.min(1000 * Math.pow(2, attemptRef.current++), 15000)
        setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      cancelled = true
      try { controller?.abort() } catch {}
    }
  }, [chatSessionId])

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

  const parseStream = async (response: Response, onTs?: (ts: string) => void) => {
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
            // Track server-provided event timestamp for reliable resuming
            if (evt && typeof evt._ts === 'string' && onTs) {
              onTs(evt._ts)
            }
            if (evt.type === "status" && evt.message) {
              setProcessingSteps(prev => [...prev, evt.message])
            }
            if (evt.type === "message" && evt.message) {
              const incoming = evt.message as ChatMessage
              setMessages(prev => {
                // Match saved user message to placeholder by content
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

                // Remove global dedup for tool messages. Only dedup within the current
                // assistant turn (nearest assistant that announced this toolCallId).
                if (incoming.role === 'tool' && incoming.toolCallId) {
                  const id = incoming.toolCallId

                  // Find nearest assistant message that contains this toolCallId
                  let nearestAssistantIdx = -1
                  for (let i = prev.length - 1; i >= 0; i--) {
                    const pm = prev[i]
                    if (pm.role === 'assistant') {
                      let hasId = false
                      if (pm.toolCalls) {
                        try {
                          const arr = JSON.parse(pm.toolCalls)
                          if (Array.isArray(arr)) {
                            hasId = arr.some((c: any) => c && (c.id === id || c.tool_call_id === id))
                          }
                        } catch {
                          // best-effort fallback: substring check
                          hasId = typeof pm.toolCalls === 'string' && pm.toolCalls.includes(id)
                        }
                      }
                      if (hasId) { nearestAssistantIdx = i; break }
                    }
                  }

                  if (nearestAssistantIdx !== -1) {
                    // Within this turn only, replace an existing tool message with same id
                    for (let i = prev.length - 1; i > nearestAssistantIdx; i--) {
                      const pm = prev[i]
                      if (pm.role === 'tool' && pm.toolCallId === id) {
                        const copy = prev.slice()
                        copy[i] = incoming
                        return copy
                      }
                    }
                  }
                }

                return [...prev, incoming]
              })
            }
            if (evt.type === "data_changed" && evt.data) {
              // The useDailyLog hook now handles optimistic updates for all operations
              // so we don't need to trigger refetch anymore
              // Only apply data updates if they match the current date
              // This prevents errors when calendar date changes while processing
              if (onDataUpdate && date === (evt.targetDate || date)) {
                if (evt.data.foodAdded) {
                  onDataUpdate({ foodAdded: evt.data.foodAdded })
                } else if (evt.data.foodUpdated) {
                  onDataUpdate({ foodUpdated: evt.data.foodUpdated })
                } else if (evt.data.foodDeleted) {
                  onDataUpdate({ foodDeleted: evt.data.foodDeleted })
                }
              }
              // Refresh userFoods when a new food is created
              if (evt.data.userFoodCreated && onUserFoodCreated) {
                onUserFoodCreated()
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
    
    // Handle /clear command
    if (text === '/clear') {
      try {
        const res = await fetch(`/api/chat-sessions/${chatSessionId}/clear`, {
          method: 'DELETE'
        })
        if (res.ok) {
          setMessages([])
          setInput("")
          // Show a brief confirmation message
          setTimeout(() => {
            setMessages([{
              role: "assistant",
              content: "Chat messages cleared for today. Your food log data is preserved."
            }])
          }, 100)
          return
        } else {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "Failed to clear chat messages. Please try again."
          }])
        }
      } catch (error) {
        console.error('Failed to clear chat messages:', error)
        setMessages(prev => [...prev, {
          role: "assistant", 
          content: "Failed to clear chat messages. Please try again."
        }])
      }
      setInput("")
      return
    }
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
      const res = await fetch(`/api/chat/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chatSessionId,
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
      // We do not read the body; processing happens in background and events arrive via SSE
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
      if (selectedFood) {
        handleQuickAddSubmit()
      } else {
        sendMessage()
      }
    } else if (e.key === "Escape") {
      if (selectedFood) {
        handleCancelQuickAdd()
      } else {
        setShowSuggestions(false)
      }
    }
  }

  // Quick-add handlers
  const handleSelectFood = (food: UserFood) => {
    setSelectedFood(food)
    setQuickAddGrams(food.defaultGrams?.toString() || "")
    setInput("")
    setShowSuggestions(false)
    setTimeout(() => gramsInputRef.current?.focus(), 50)
  }

  const handleQuickAddSubmit = async () => {
    if (!selectedFood || !quickAddGrams || !onQuickAdd) return
    const gramsNum = parseFloat(quickAddGrams)
    if (isNaN(gramsNum) || gramsNum <= 0) return

    setQuickAdding(true)
    try {
      await onQuickAdd({ userFoodId: selectedFood.id, grams: gramsNum })
      setSelectedFood(null)
      setQuickAddGrams("")
      setInput("")
      inputRef.current?.focus()
    } catch (error) {
      console.error("Failed to quick-add:", error)
    } finally {
      setQuickAdding(false)
    }
  }

  const handleCancelQuickAdd = () => {
    setSelectedFood(null)
    setQuickAddGrams("")
    inputRef.current?.focus()
  }

  const previewCalories = selectedFood && quickAddGrams
    ? Math.round((selectedFood.caloriesPer100g * parseFloat(quickAddGrams || "0")) / 100)
    : 0

  return (
    <div className="bg-white rounded-lg shadow-md p-3 md:p-4 h-full flex flex-col" ref={chatRef}>
      <div className="flex-1 overflow-y-auto space-y-2" ref={messagesContainerRef}>
        {messages.map((message, index) => {
          // Show a pill as soon as the assistant announces the lookup tool call
          if (message.role === 'assistant' && message.toolCalls) {
            try {
              const calls = JSON.parse(message.toolCalls as any)
              if (Array.isArray(calls)) {
                const lookupCall = calls.find((c: any) => {
                  const fn = c?.function || c?.["function_call"]
                  return fn && fn.name === 'lookup_nutritional_info'
                })
                if (lookupCall) {
                  let desc: string | null = null
                  try {
                    const fn = lookupCall.function || lookupCall["function_call"]
                    const argStr = fn?.arguments || fn?.args
                    if (typeof argStr === 'string' && argStr.trim().length > 0) {
                      const parsed = JSON.parse(argStr)
                      if (parsed && typeof parsed.foodDescription === 'string' && parsed.foodDescription.trim().length > 0) {
                        desc = parsed.foodDescription.trim()
                      }
                    }
                  } catch {}

                  return (
                    <div key={index} className="flex justify-start mt-2">
                      <div className="flex flex-wrap gap-2 max-w-2xl">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm border-blue-300 bg-blue-100 text-blue-800`}>
                          <span className="mr-1.5">🔎</span>
                          {desc ? `Looking up: ${desc}` : 'Looking up nutritional information…'}
                        </span>
                      </div>
                    </div>
                  )
                }
              }
            } catch {}
          }
          if (message.role === "tool") {
            // Display tool message as a pill
            if (!message.content) return null
            
            // Extract only the first line for display in the UI pill
            const firstLine = message.content.split('\n')[0]
            const isNutritionalLookup = firstLine.toLowerCase().startsWith("found nutritional information")

            // Simplify nutritional lookup display
            const displayText = isNutritionalLookup ? "Found nutritional info" : firstLine

            const getActionIcon = (text: string) => {
              const t = text.toLowerCase()
              if (t.includes("error")) return "❌"
              if (t.includes("added")) return "✅"
              if (t.includes("updated")) return "✏️"
              if (t.includes("deleted")) return "🗑️"
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
              <div key={index} className="flex justify-start mt-2">
                <div className="flex flex-wrap gap-2 max-w-2xl">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${getActionColor(displayText)}`}>
                    <span className="mr-1.5">{isNutritionalLookup ? "✅" : getActionIcon(displayText)}</span>
                    {displayText}
                  </span>
                </div>
              </div>
            )
          }
          
          // Regular user/assistant message
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
                      {message.content && (
                        message.role === "assistant" ? (
                          <MarkdownRenderer content={message.content} />
                        ) : (
                          <p className="text-xs md:text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        )
                      )}
                    </div>
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

      {/* Search suggestions */}
      {showSuggestions && searchResults.length > 0 && !selectedFood && (
        <div className="mb-2 bg-gray-50 rounded-lg border border-gray-200 max-h-48 overflow-y-auto z-20 relative">
          {searchResults.map((food) => (
            <button
              key={food.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectFood(food)}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 active:bg-blue-100 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="font-medium text-gray-900 text-sm">{food.name}</div>
              <div className="text-xs text-gray-500">
                {Math.round(food.caloriesPer100g)} cal/100g
                {food.defaultGrams && ` · ${food.defaultGrams}g`}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Quick-add mode: food selected, entering grams */}
      {selectedFood ? (
        <div className="flex items-center gap-1.5 md:gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <button
            onClick={handleCancelQuickAdd}
            disabled={quickAdding}
            className="p-1.5 text-gray-500 hover:text-gray-700 flex-shrink-0"
          >
            ✕
          </button>
          <div className="flex-1 w-0">
            <div className="font-medium text-gray-900 text-sm truncate">{selectedFood.name}</div>
            <div className="text-xs text-gray-600">{previewCalories} kcal</div>
          </div>
          <input
            ref={gramsInputRef}
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quickAddGrams}
            onChange={(e) => setQuickAddGrams(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setTimeout(() => {
                try {
                  chatRef.current?.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'smooth' })
                } catch {}
              }, 500)
            }}
            placeholder="grams"
            className="w-16 md:w-20 px-2 py-1.5 border border-gray-300 rounded-md text-center text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={quickAdding}
          />
          <button
            onClick={handleQuickAddSubmit}
            disabled={quickAdding || !quickAddGrams || parseFloat(quickAddGrams) <= 0}
            className="px-2.5 md:px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
          >
            {quickAdding ? "..." : "Add"}
          </button>
        </div>
      ) : (
        <div className="flex space-x-2 mt-3 md:mt-4">
          <div className="flex items-center">
            <label
              className="cursor-pointer inline-flex items-center px-2 py-2 border border-gray-400 rounded-lg text-xs md:text-sm text-gray-800 hover:bg-gray-50"
              onClick={(e) => {
                if (loading) return
                if (isAndroid()) {
                  e.preventDefault()
                  openCamera()
                }
              }}
            >
              📷
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*;capture=environment"
                {...({ capture: 'environment' } as any)}
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
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setShowSuggestions(true)
              setTimeout(() => {
                try {
                  chatRef.current?.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'smooth' })
                } catch {}
              }, 500)
            }}
            onBlur={() => {
              // Longer delay on mobile to allow touch on suggestion
              setTimeout(() => setShowSuggestions(false), 400)
            }}
            placeholder="Type food name or chat message..."
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
      )}

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

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-black p-2 rounded-lg w-full max-w-sm mx-4">
            <video
              ref={videoRef}
              className="w-full h-auto rounded"
              autoPlay
              playsInline
              muted
            />
            <div className="mt-2 flex justify-between">
              <button
                className="bg-white text-black px-3 py-2 rounded"
                onClick={capturePhotoFromStream}
              >
                Capture
              </button>
              <button
                className="text-white px-3 py-2"
                onClick={closeCamera}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
