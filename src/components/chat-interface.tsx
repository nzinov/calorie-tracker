"use client"

import { useState, useEffect, useRef } from "react"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface FoodSuggestion {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

interface ChatResponse {
  foods?: FoodSuggestion[]
  message: string
  foodAdded?: any
  foodUpdated?: boolean
  foodDeleted?: boolean
  toolResults?: string[]
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat session from database on mount or when date changes
  useEffect(() => {
    loadChatSession()
  }, [date]) // loadChatSession is defined within the component, so it's safe to omit

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
          setMessages(session.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content
          })))
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
        setMessages(session.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })))
      }
    } catch (error) {
      console.error('Failed to create chat session:', error)
      // Fallback to default message
      setMessages([{
        role: "assistant",
        content: "Hi! I'm here to help you track your nutrition. Tell me what you ate and I'll log it for you!"
      }])
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveMessageToDatabase = async (role: string, content: string) => {
    if (!chatSessionId) return

    try {
      await fetch(`/api/chat-sessions/${chatSessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role, content })
      })
    } catch (error) {
      console.error('Failed to save message to database:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !chatSessionId) return

    const userMessage = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: userMessage }])
    setLoading(true)

    // Save user message to database
    await saveMessageToDatabase("user", userMessage)

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
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get AI response")
      }

      const data: ChatResponse = await response.json()

      const assistantMessage = {
        role: "assistant" as const,
        content: data.message
      }

      setMessages(prev => [...prev, assistantMessage])

      // Save assistant message to database
      await saveMessageToDatabase("assistant", data.message)

      // If any tool was used to modify data, refresh the parent component
      if (data.foodAdded || data.foodUpdated || data.foodDeleted) {
        onDataChange?.()
      }
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage = "Sorry, I'm having trouble connecting to the AI service. Please check your OpenRouter API key configuration."
      setMessages(prev => [...prev, {
        role: "assistant",
        content: errorMessage
      }])
      // Save error message to database
      await saveMessageToDatabase("assistant", errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const [pendingFoods, setPendingFoods] = useState<FoodSuggestion[]>([])

  const handleAddFoods = () => {
    setPendingFoods([])
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "Great! I've added those foods to your log."
    }])
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
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-2xl px-4 py-2 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              <p className="text-xs md:text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
        
        {pendingFoods.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-green-100 border border-green-300 rounded-lg p-3 max-w-md">
              <div className="space-y-2">
                {pendingFoods.map((food, index) => (
                  <div key={index} className="text-sm">
                    <strong>{food.name}</strong> ({food.quantity}): {food.calories} cal
                  </div>
                ))}
                <button
                  onClick={handleAddFoods}
                  className="mt-2 bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                >
                  Add to Log
                </button>
              </div>
            </div>
          </div>
        )}
        
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
    </div>
  )
}
