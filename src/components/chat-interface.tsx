"use client"

import { useState, useEffect, useRef } from "react"

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
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

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


  const loadMessages = async () => {
    if (!chatSessionId) return
    
    try {
      const params = date ? `?date=${date}` : ''
      const response = await fetch(`/api/chat-sessions${params}`)
      if (response.ok) {
        const chatSessions = await response.json()
        if (chatSessions.length > 0) {
          const session = chatSessions[0]
          const serverMessages = session.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            toolCalls: msg.toolCalls,
            toolCallId: msg.toolCallId
          }))
          
          // Replace all messages with server messages (removes temp messages)
          setMessages(serverMessages)
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

  // Load messages when chat session changes
  useEffect(() => {
    if (chatSessionId) {
      loadMessages()
    }
  }, [chatSessionId])

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
  }, [messages, processingSteps])


  const addMessageToUI = (message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !chatSessionId) return

    const userMessage = input.trim()
    setInput("")
    setLoading(true)
    setProcessingSteps([])
    
    // Immediately add user message to UI
    const userMessageObj: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      toolCalls: null,
      toolCallId: null
    }
    addMessageToUI(userMessageObj)
    
    // Show processing indicator
    setProcessingSteps(["Processing your request..."])

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
      
      // Show completion step
      setProcessingSteps(["Complete! Loading messages..."])
      
      // Small delay to show completion before refreshing
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Refresh messages from server to get the actual saved messages with proper IDs
      await loadMessages()

      // If any tool was used to modify data, refresh the parent component
      if (data.foodAdded || data.foodUpdated || data.foodDeleted) {
        onDataChange?.()
      }
    } catch (error) {
      console.error("Chat error:", error)
      // Add error message to UI
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant", 
        content: "Sorry, I'm having trouble connecting. Please try again.",
        toolCalls: null,
        toolCallId: null
      }
      addMessageToUI(errorMessage)
    } finally {
      setLoading(false)
      setProcessingSteps([])
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
          
          // Don't show empty assistant messages (they only had tool calls)
          if (message.role === "assistant" && (!message.content || message.content.trim() === "")) {
            // But still show tool result pills if there are any
            if (message.toolCalls) {
              const toolResults = getToolResultsForMessage(message, messages)
              if (toolResults.length > 0) {
                return (
                  <div key={index}>
                    {/* Tool result pills only */}
                    <div className="flex justify-start">
                      <div className="flex flex-wrap gap-2 max-w-2xl">
                        {toolResults.map((toolResult, i) => {
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
                  </div>
                )
              }
            }
            return null
          }

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
        
        {/* Show processing steps */}
        {processingSteps.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2 rounded-lg">
              {processingSteps.map((step, index) => (
                <p key={index} className="text-xs md:text-sm">
                  {step}
                </p>
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
