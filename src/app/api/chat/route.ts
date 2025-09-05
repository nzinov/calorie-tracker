import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"
import { addFoodEntry, deleteFoodEntry, editFoodEntry } from "@/lib/food"
import { readFileSync } from "fs"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"
import { homedir } from "os"
import { join } from "path"

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

const SYSTEM_PROMPT = "You are a helpful nutrition assistant for a calorie tracking app. Your main tasks are:\n\n1. Help users log food by extracting nutritional information from their descriptions\n2. Provide nutritional recommendations based on their daily targets\n3. Answer nutrition-related questions\n4. Help users edit or delete existing food entries\n\nDaily targets:\n- Calories: 2000 kcal\n- Protein: 156g\n- Fat: 78g\n- Carbohydrates: 165g\n- Fiber: 37g\n- Salt: 5g\n\nYou have access to the following tools:\n- add_food_entry: Add new food entries to the log\n- edit_food_entry: Edit existing food entries\n- delete_food_entry: Delete food entries\n- get_food_entries: Get current food entries for today\n\nWhen users describe food they ate, use the add_food_entry tool. When they want to modify or remove entries, use the appropriate tools."

async function saveMessageToDb(chatSessionId: string, role: string, content: string | null, toolCalls: string | null, toolCallId: string | null) {
  if (!chatSessionId) return
  
  await prisma.chatMessage.create({
    data: {
      role,
      content: content || "",
      chatSessionId,
      toolCalls,
      toolCallId
    }
  })
}

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
          fiber: { type: "number", description: "Fiber in grams" },
          salt: { type: "number", description: "Salt in grams" }
        },
        required: ["name", "quantity", "calories", "protein", "carbs", "fat", "fiber", "salt"]
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
          fiber: { type: "number", description: "New fiber in grams" },
          salt: { type: "number", description: "New salt in grams" }
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
                      currentTotals.fat + "g fat, " + currentTotals.fiber + "g fiber, " +
                      currentTotals.salt + "g salt."
    }
    
    let foodEntriesContext = "No food entries logged today yet."
    if (foodEntries && foodEntries.length > 0) {
      const entryList = foodEntries.map((entry: any) => entry.name + " (" + entry.quantity + ") - ID: " + entry.id).join(', ')
      foodEntriesContext = "Current food entries: " + entryList
    }

    const systemContent = SYSTEM_PROMPT + (contextMessage ? "\n\n" + contextMessage + "\n\n" + foodEntriesContext : "\n\n" + foodEntriesContext)

    // Build conversation history from stored chat messages
    const builtMessages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string; tool_calls?: any }> = []
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
          messages: { 
            orderBy: { timestamp: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              timestamp: true,
              toolCalls: true,
              toolCallId: true
            }
          },
        },
      })

      if (chatSession) {
        // Convert stored messages back to OpenAI format
        const history: Array<{ role: "user" | "assistant" | "tool"; content: string; tool_calls?: any; tool_call_id?: string }> = []
        
        chatSession.messages.forEach((m) => {
          if (m.role === 'user') {
            history.push({ role: 'user', content: m.content || '' })
          } else if (m.role === 'assistant') {
            const msg: any = { role: 'assistant', content: m.content || '' }
            if (m.toolCalls) {
              try {
                msg.tool_calls = JSON.parse(m.toolCalls)
              } catch (e) {
                console.error('Failed to parse tool calls:', e)
              }
            }
            history.push(msg)
          } else if (m.role === 'tool') {
            history.push({ 
              role: 'tool', 
              content: m.content || '',
              tool_call_id: m.toolCallId || ''
            })
          }
        })

        // Keep last reasonable number of messages to manage token usage
        // Always trim before a user message to maintain conversation flow
        const MAX_MESSAGES = 100
        let trimmed = history
        
        if (history.length > MAX_MESSAGES) {
          // Find the first user message in the last MAX_MESSAGES messages
          const startIndex = history.length - MAX_MESSAGES
          let trimStartIndex = startIndex
          
          // Look for the first user message at or after the start index
          for (let i = startIndex; i < history.length; i++) {
            if (history[i].role === 'user') {
              trimStartIndex = i
              break
            }
          }
          
          trimmed = history.slice(trimStartIndex)
          console.log(`Trimmed conversation from ${history.length} to ${trimmed.length} messages, starting with ${trimmed[0]?.role}`)
        }
        
        builtMessages.push(...trimmed)
        
        // Always append the current user message to the conversation 
        builtMessages.push({ role: "user", content: message })
      } else {
        // If no chat session found, add the user message
        builtMessages.push({ role: "user", content: message })
      }
    }


    const requestPayload = {
      model: "anthropic/claude-3.5-sonnet",
      messages: builtMessages,
      tools: tools,
      temperature: 0.7,
      max_tokens: 1000,
    }

    console.log("=== LLM REQUEST ===")
    console.log("Timestamp:", new Date().toISOString())
    console.log("Chat Session ID:", chatSessionId)
    console.log("User Message:", message)
    console.log("Request Payload:", JSON.stringify(requestPayload, null, 2))

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + getOpenRouterApiKey(),
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "Calorie Tracker App",
      },
      body: JSON.stringify(requestPayload),
    })

    if (!response.ok) {
      throw new Error("OpenRouter API error: " + response.statusText)
    }

    const data = await response.json()
    const aiMessage = data.choices[0]?.message

    console.log("=== LLM RESPONSE ===")
    console.log("Response Status:", response.status)
    console.log("Response Data:", JSON.stringify(data, null, 2))

    if (!aiMessage) {
      console.log("ERROR: No AI message in response")
      throw new Error("No response from AI")
    }

    const result: any = { 
      foodAdded: null,
      foodUpdated: false,
      foodDeleted: false
    }

    // Save the user message first
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
    await saveMessageToDb(chatSessionId, "user", message, null, null)

    // Handle multiple rounds of tool calling in a loop
    let currentMessage = aiMessage
    let roundCount = 0
    const maxRounds = 15 // Prevent infinite loops
    
    while (roundCount < maxRounds) {
      const toolCalls = currentMessage?.tool_calls
      
      console.log(`=== TOOL ROUND ${roundCount + 1} ===`)
      console.log("Current Message:", JSON.stringify(currentMessage, null, 2))
      console.log("Tool Calls:", toolCalls ? JSON.stringify(toolCalls, null, 2) : "None")
      
      if (!toolCalls || toolCalls.length === 0) {
        // No more tool calls, save final assistant message and break
        console.log("No more tool calls, finishing")
        if (currentMessage?.content) {
          await saveMessageToDb(chatSessionId, "assistant", currentMessage.content, null, null)
        }
        break
      }

      // Save assistant message with tool calls
      await saveMessageToDb(chatSessionId, "assistant", currentMessage.content || null, JSON.stringify(toolCalls), null)

      // Add the assistant's tool call message to conversation
      builtMessages.push({
        role: "assistant",
        content: currentMessage.content,
        tool_calls: toolCalls
      } as any)
      
      const toolMessages = []
      
      // Execute each tool call
      for (const toolCall of toolCalls) {
        const { id: toolCallId, function: { name, arguments: args } } = toolCall
        const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
        
        console.log(`--- Executing Tool: ${name} ---`)
        console.log("Tool Call ID:", toolCallId)
        console.log("Tool Args:", JSON.stringify(parsedArgs, null, 2))
        
        let toolResult = ""
        
        try {
          switch (name) {
            case 'add_food_entry': {
              const entry = await addFoodEntry(userId, parsedArgs)
              toolResult = `Successfully added ${parsedArgs.name} (${parsedArgs.quantity}) with ${parsedArgs.calories} calories to your food log.`
              result.foodAdded = entry
              console.log("Tool Result:", toolResult)
              break
            }
            case 'edit_food_entry': {
              await editFoodEntry('', parsedArgs.id, parsedArgs)
              toolResult = `Successfully updated food entry.`
              result.foodUpdated = true
              console.log("Tool Result:", toolResult)
              break
            }
            case 'delete_food_entry': {
              await deleteFoodEntry('', parsedArgs.id)
              toolResult = `Successfully deleted food entry.`
              result.foodDeleted = true
              console.log("Tool Result:", toolResult)
              break
            }
          }
        } catch (error) {
          toolResult = `Error executing ${name}: ${error}`
          console.log("Tool Error:", error)
        }
        
        // Save tool message to database
        await saveMessageToDb(chatSessionId, "tool", toolResult, null, toolCallId)
        
        // Add tool result message to conversation
        toolMessages.push({
          role: "tool" as const,
          content: toolResult,
          tool_call_id: toolCallId
        })
      }
      
      // Add tool result messages to conversation
      builtMessages.push(...toolMessages)
      
      // Make follow-up request to get next response
      const followupPayload = {
        model: "anthropic/claude-3.5-sonnet",
        messages: builtMessages,
        tools: tools,
        temperature: 0.7,
        max_tokens: 1000,
      }

      console.log("=== FOLLOW-UP REQUEST ===")
      console.log("Follow-up Payload:", JSON.stringify(followupPayload, null, 2))

      const followupResponse = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + getOpenRouterApiKey(),
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "Calorie Tracker App",
        },
        body: JSON.stringify(followupPayload),
      })
      
      if (!followupResponse.ok) {
        console.error("Follow-up request failed:", followupResponse.statusText)
        break
      }
      
      const followupData = await followupResponse.json()
      console.log("=== FOLLOW-UP RESPONSE ===")
      console.log("Follow-up Data:", JSON.stringify(followupData, null, 2))
      
      currentMessage = followupData.choices[0]?.message
      roundCount++
    }
    
    // If we hit max rounds, save a warning message
    if (roundCount >= maxRounds) {
      console.log("WARNING: Hit max rounds limit")
      await saveMessageToDb(chatSessionId, "assistant", "I've completed the available actions. If you need more assistance, please let me know!", null, null)
    }

    console.log("=== FINAL RESULT ===")
    console.log("Final Result:", JSON.stringify(result, null, 2))

    return NextResponse.json({
      ...result,
      completed: true
    })
  } catch (error) {
    console.error("Error in chat API:", error)
    console.error("Error details:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    )
  }
}
