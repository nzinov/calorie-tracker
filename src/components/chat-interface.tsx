"use client"

import { useState, useEffect, useRef } from "react"
import { DebugPopup } from "./debug-popup"

interface ChatMessage {
  id?: string
  role: "user" | "assistant" | "tool"
  content: string | null
  toolCalls?: string | null  // JSON string of tool calls
  toolCallId?: string | null // Tool call ID for tool messages
}

interface ChatResponse {
  foodAdded?: any
  foodUpdated?: boolean
  foodDeleted?: boolean
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
  onDataChange?: () => void
  date?: string
}

export function ChatInterface({ currentTotals, foodEntries, onDataChange, date }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [debugPopupOpen, setDebugPopupOpen] = useState(false)
  const [debugData, setDebugData] = useState<{prompt: string, response: string} | null>(null)
  const [debugMessageId, setDebugMessageId] = useState<string | null>(null)

  // Helper function to get tool results for an assistant message
  const getToolResultsForMessage = (assistantMessage: ChatMessage, allMessages: ChatMessage[]): string[] => {
    if (!assistantMessage.toolCalls) return []
    
    try {
      const toolCalls = JSON.parse(assistantMessage.toolCalls)
      const toolCallIds = toolCalls.map((call: any) => call.id)
      
      // Find all tool messages that correspond to these tool calls
      const toolResults: string[] = []
      allMessages.forEach((msg) => {
        if (msg.role === "tool" && msg.toolCallId && toolCallIds.includes(msg.toolCallId)) {
          if (msg.content) {
            toolResults.push(msg.content)
          }
        }
      })
      
      return toolResults
    } catch (error) {
      console.error('Failed to parse tool calls:', error)
      return []
    }
  }

  const fetchDebugData = async (messageId: string) => {
    try {
      const response = await fetch(`/api/chat-messages/${messageId}/debug`)
      if (response.ok) {
        const data = await response.json()
        setDebugData(data.debugData)
        setDebugMessageId(messageId)
        setDebugPopupOpen(true)
      } else {
        console.error('Failed to fetch debug data')
        // You could show a toast here
      }
    } catch (error) {
      console.error('Error fetching debug data:', error)
    }
  }

  const loadMessages = async () => {
    if (!chatSessionId) return
    
    try {
      const params = date ? `?date=${date}` : ''
      const response = await fetch(`/api/chat-sessions${params}`)
      if (response.ok) {
        const chatSessions = await response.json()
        if (chatSessions.length > 0) {
          const session = chatSessions[0]
          setMessages(session.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            toolCalls: msg.toolCalls,
            toolCallId: msg.toolCallId
          })))
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  // Load chat session from database on mount or when date changes
  useEffect(() => {
    loadChatSession()
  }, [date])

  // Load messages when chat session changes or refresh is triggered
  useEffect(() => {
    if (chatSessionId) {
      loadMessages()
    }
  }, [chatSessionId, refreshTrigger])

  const loadChatSession = async () => {
    try {
      const params = date ? `?date=${date}` : ''
      const response = await fetch(`/api/chat-sessions${params}`)
      if (response.ok) {
        const chatSessions = await response.json()
        if (chatSessions.length > 0) {
          // Use the first (and only) session for this day
          const session = chatSessions[0]
          setChatSessionId(session.id)
        } else {
          // Create a new session
          await createNewChatSession()
        }
      } else {
        // Create a new session if fetch fails
        await createNewChatSession()
      }
    } catch (error) {
      console.error('Failed to load chat session:', error)
      await createNewChatSession()
    }
  }

  const createNewChatSession = async () => {
    try {
      const response = await fetch('/api/chat-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date })
      })
      if (response.ok) {
        const session = await response.json()
        setChatSessionId(session.id)
      }
    } catch (error) {
      console.error('Failed to create chat session:', error)
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])


  const sendMessage = async () => {
    if (!input.trim() || loading || !chatSessionId) return

    const userMessage = input.trim()
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          currentTotals: currentTotals,
          foodEntries: foodEntries,
          chatSessionId: chatSessionId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get AI response")
      }

      const data: ChatResponse = await response.json()

      // Trigger refresh to show all new messages
      setRefreshTrigger(prev => prev + 1)

      // If any tool was used to modify data, refresh the parent component
      if (data.foodAdded || data.foodUpdated || data.foodDeleted) {
        onDataChange?.()
      }
    } catch (error) {
      console.error("Chat error:", error)
      // Just refresh to show any messages that were saved
      setRefreshTrigger(prev => prev + 1)
    } finally {
      setLoading(false)
    }
  }


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6 h-full grid grid-rows-[auto_1fr_auto] min-h-[300px]">
      <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">AI Nutrition Assistant</h2>
      
      <div className="overflow-y-auto space-y-3 md:space-y-4 min-h-0">
        {messages.map((message, index) => {
          // Don't display tool messages as chat bubbles - they'll be shown as pills
          if (message.role === "tool") return null

          return (
            <div key={index}>
              {/* Regular chat message */}
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
                  {message.role === "assistant" && message.id && (
                    <button
                      onClick={() => fetchDebugData(message.id!)}
                      className="mt-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 rounded border border-gray-300 hover:border-gray-400 transition-colors"
                      title="View LLM debug data"
                    >
                      Debug
                    </button>
                  )}
                </div>
              </div>

              {/* Tool result pills for this assistant message */}
              {message.role === "assistant" && message.toolCalls && (
                <div className="flex justify-start mt-2">
                  <div className="flex flex-wrap gap-2 max-w-2xl">
                    {getToolResultsForMessage(message, messages).map((toolResult, i) => {
                      const getActionIcon = (text: string) => {
                        if (text.toLowerCase().includes('added')) return '✅'
                        if (text.toLowerCase().includes('updated')) return '✏️'
                        if (text.toLowerCase().includes('deleted')) return '🗑️'
                        if (text.toLowerCase().includes('error')) return '❌'
                        return '📝'
                      }
                      
                      const getActionColor = (text: string) => {
                        if (text.toLowerCase().includes('error')) return 'border-red-300 bg-red-100 text-red-800'
                        if (text.toLowerCase().includes('deleted')) return 'border-orange-300 bg-orange-100 text-orange-800'
                        if (text.toLowerCase().includes('updated')) return 'border-blue-300 bg-blue-100 text-blue-800'
                        return 'border-emerald-300 bg-emerald-100 text-emerald-800'
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
        
        <div ref={messagesEndRef} />
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
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
      
      <DebugPopup
        isOpen={debugPopupOpen}
        onClose={() => setDebugPopupOpen(false)}
        debugData={debugData}
        messageId={debugMessageId}
      />
    </div>
  )
}
