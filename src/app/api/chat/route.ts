import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { addFoodEntry, editFoodEntry, deleteFoodEntry } from "@/lib/food"
import { db as prisma } from "@/lib/db"

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

let cachedApiKey: string | null = null

function getOpenRouterApiKey(): string {
  if (cachedApiKey) {
    return cachedApiKey
  }

  if (process.env.OPENROUTER_API_KEY) {
    console.log('Using OPENROUTER_API_KEY from environment')
    cachedApiKey = process.env.OPENROUTER_API_KEY
    return cachedApiKey
  }
  
  try {
    const tokenPath = join(homedir(), '.openrouter.token')
    console.log('Trying to read token from:', tokenPath)
    const token = readFileSync(tokenPath, 'utf8').trim()
    console.log('Successfully read token, length:', token.length)
    cachedApiKey = token
    return token
  } catch (error) {
    console.error('Error reading token file:', error)
    throw new Error('OPENROUTER_API_KEY not found in environment or ~/.openrouter.token file')
  }
}

const SYSTEM_PROMPT = "You are a helpful nutrition assistant for a calorie tracking app. Your main tasks are:\n\n1. Help users log food by extracting nutritional information from their descriptions\n2. Provide nutritional recommendations based on their daily targets\n3. Answer nutrition-related questions\n4. Help users edit or delete existing food entries\n\nDaily targets:\n- Calories: 2000 kcal\n- Protein: 156g\n- Fat: 78g\n- Carbohydrates: 165g\n- Fiber: 37g\n\nYou have access to the following tools:\n- add_food_entry: Add new food entries to the log\n- edit_food_entry: Edit existing food entries\n- delete_food_entry: Delete food entries\n- get_food_entries: Get current food entries for today\n\nWhen users describe food they ate, use the add_food_entry tool. When they want to modify or remove entries, use the appropriate tools."

const tools = [
  {
    type: "function",
    function: {
      name: "add_food_entry",
      description: "Add a new food entry to today's log",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the food" },
          quantity: { type: "string", description: "Amount consumed (e.g., 1 cup, 150g)" },
          calories: { type: "number", description: "Calories per serving" },
          protein: { type: "number", description: "Protein in grams" },
          carbs: { type: "number", description: "Carbohydrates in grams" },
          fat: { type: "number", description: "Fat in grams" },
          fiber: { type: "number", description: "Fiber in grams" }
        },
        required: ["name", "quantity", "calories", "protein", "carbs", "fat", "fiber"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_food_entry",
      description: "Edit an existing food entry",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID of the food entry to edit" },
          name: { type: "string", description: "New name of the food" },
          quantity: { type: "string", description: "New amount" },
          calories: { type: "number", description: "New calories" },
          protein: { type: "number", description: "New protein in grams" },
          carbs: { type: "number", description: "New carbohydrates in grams" },
          fat: { type: "number", description: "New fat in grams" },
          fiber: { type: "number", description: "New fiber in grams" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_food_entry",
      description: "Delete a food entry from today's log",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID of the food entry to delete" }
        },
        required: ["id"]
      }
    }
  }
]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { message, currentTotals, foodEntries, chatSessionId } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    let contextMessage = ""
    if (currentTotals) {
      contextMessage = "Current daily totals: " + currentTotals.calories + " calories, " + 
                      currentTotals.protein + "g protein, " + currentTotals.carbs + "g carbs, " + 
                      currentTotals.fat + "g fat, " + currentTotals.fiber + "g fiber."
    }
    
    let foodEntriesContext = "No food entries logged today yet."
    if (foodEntries && foodEntries.length > 0) {
      const entryList = foodEntries.map((entry: any) => entry.name + " (" + entry.quantity + ") - ID: " + entry.id).join(', ')
      foodEntriesContext = "Current food entries: " + entryList
    }

    const systemContent = SYSTEM_PROMPT + (contextMessage ? "\n\n" + contextMessage + "\n\n" + foodEntriesContext : "\n\n" + foodEntriesContext)

    // Build conversation history from stored chat messages
    const builtMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = []
    builtMessages.push({ role: "system", content: systemContent })

    if (chatSessionId) {
      const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

      // Verify the chat session belongs to the user and fetch messages
      const chatSession = await prisma.chatSession.findFirst({
        where: {
          id: chatSessionId,
          dailyLog: {
            userId,
          },
        },
        include: {
          messages: { orderBy: { timestamp: 'asc' } },
        },
      })

      if (chatSession) {
        // Map stored messages into the API format and cap history
        const history = chatSession.messages.map((m) => ({
          role: (m.role === 'user' || m.role === 'assistant') ? (m.role as 'user' | 'assistant') : 'user',
          content: m.content,
        }))

        // Keep last 10 turns (20 messages) to manage token usage
        const MAX_MESSAGES = 20
        const trimmed = history.length > MAX_MESSAGES ? history.slice(history.length - MAX_MESSAGES) : history
        builtMessages.push(...trimmed)
      }
    }

    // Append the current user message as the latest turn
    builtMessages.push({ role: "user", content: message })

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + getOpenRouterApiKey(),
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "Calorie Tracker App",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: builtMessages,
        tools: tools,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error("OpenRouter API error: " + response.statusText)
    }

    const data = await response.json()
    const aiMessage = data.choices[0]?.message
    const toolCalls = aiMessage?.tool_calls

    if (!aiMessage) {
      throw new Error("No response from AI")
    }

    const result: any = { message: aiMessage.content || "I'm processing your request..." }

    // Handle tool calls
    if (toolCalls && toolCalls.length > 0) {
      const toolResults = []
      
      for (const toolCall of toolCalls) {
        const { name, arguments: args } = toolCall.function
        const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
        
        try {
          switch (name) {
            case 'add_food_entry': {
              const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
              const entry = await addFoodEntry(userId, parsedArgs)
              toolResults.push("Added " + parsedArgs.name + " to your log")
              result.foodAdded = entry
              break
            }
            case 'edit_food_entry': {
              await editFoodEntry('', parsedArgs.id, parsedArgs)
              toolResults.push("Updated food entry")
              result.foodUpdated = true
              break
            }
            case 'delete_food_entry': {
              await deleteFoodEntry('', parsedArgs.id)
              toolResults.push("Deleted food entry")
              result.foodDeleted = true
              break
            }
          }
        } catch (error) {
          toolResults.push("Error with " + name + ": " + error)
        }
      }
      
      if (toolResults.length > 0) {
        result.message = aiMessage.content + (toolResults.length > 0 ? " " + toolResults.join('. ') : '')
        result.toolResults = toolResults
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in chat API:", error)
    console.error("Error details:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    )
  }
}
