import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"
import { addFoodEntry, deleteFoodEntry, editFoodEntry } from "@/lib/food"
import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

let cachedApiKey: string | null = null

function getOpenRouterApiKey(): string {
  if (cachedApiKey) {
    return cachedApiKey
  }

  if (process.env.OPENROUTER_API_KEY) {
    cachedApiKey = process.env.OPENROUTER_API_KEY
    return cachedApiKey
  }
  
  try {
    const tokenPath = join(homedir(), '.openrouter.token')
    const token = readFileSync(tokenPath, 'utf8').trim()
    cachedApiKey = token
    return token
  } catch (error) {
    throw new Error('OPENROUTER_API_KEY not found in environment or ~/.openrouter.token file')
  }
}

function formatOpenRouterError(status: number, statusText: string, body: any): string {
  try {
    if (body && typeof body === 'object') {
      const msg = (body as any).error?.message || (body as any).message || (body as any).detail || JSON.stringify(body)
      return `OpenRouter error ${status} ${statusText}: ${msg}`
    }
    if (typeof body === 'string' && body.trim().length > 0) {
      return `OpenRouter error ${status} ${statusText}: ${body}`
    }
  } catch {}
  return `OpenRouter error ${status} ${statusText}`
}

function extractProviderError(body: any): string | null {
  try {
    if (!body) return null
    if (typeof body === 'string') return null
    // common fields
    const candidates: any[] = [
      (body as any).provider_error,
      (body as any).error?.details,
      (body as any).error?.message,
      (body as any).message,
      (body as any).detail,
    ].filter(Boolean)
    if (Array.isArray((body as any).errors) && (body as any).errors.length > 0) {
      const first = (body as any).errors[0]
      if (typeof first === 'string') candidates.push(first)
      if (typeof first?.message === 'string') candidates.push(first.message)
      if (typeof first?.detail === 'string') candidates.push(first.detail)
    }
    const text = candidates.find((x) => typeof x === 'string' && x.trim().length > 0)
    return text || null
  } catch {
    return null
  }
}

async function saveMessageToDb(chatSessionId: string, role: string, content: string | null, toolCalls: string | null, toolCallId: string | null) {
  if (!chatSessionId) return null
  
  const message = await prisma.chatMessage.create({
    data: {
      role,
      content: content || "",
      chatSessionId,
      toolCalls,
      toolCallId
    }
  })
  return message
}

const SYSTEM_PROMPT = "You are a helpful nutrition assistant for a calorie tracking app. Your main tasks are:\n\n1. Help users log food by extracting nutritional information from their descriptions\n2. Provide nutritional recommendations based on their daily targets\n3. Answer nutrition-related questions\n4. Help users edit or delete existing food entries\n\nDaily targets:\n- Calories: 2000 kcal\n- Protein: 156g\n- Fat: 78g\n- Carbohydrates: 165g\n- Fiber: 37g\n- Salt: 5g\n\nYou have access to the following tools:\n- add_food_entry: Add new food entries to the log\n- edit_food_entry: Edit existing food entries\n- delete_food_entry: Delete food entries\n- get_food_entries: Get current food entries for today\n\nWhen users describe food they ate, use the add_food_entry tool. When they want to modify or remove entries, use the appropriate tools."

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

function dataUrlToEncoded(imageDataUrl: string): { url: string; mime_type: string } | null {
  try {
    if (!imageDataUrl || typeof imageDataUrl !== 'string') return null
    if (imageDataUrl.startsWith('encoded:')) {
      // Unknown MIME in this case; omit instead of guessing
      return { url: imageDataUrl, mime_type: '' }
    }
    const m = imageDataUrl.match(/^data:(.*?);base64,(.*)$/)
    if (!m) return null
    const mime = m[1]
    const b64 = m[2]
    return { url: `encoded:${b64}`, mime_type: mime }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: any) => {
        const json = JSON.stringify(data)
        controller.enqueue(encoder.encode(`data: ${json}\n\n`))
      }

      try {
        const session = await getServerSession(authOptions)
        
        if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
          sendUpdate({ type: "error", error: "Unauthorized" })
          controller.close()
          return
        }

        const body = await request.json()
        const { message, currentTotals, foodEntries, chatSessionId, imageDataUrl } = body

        const hasText = typeof message === 'string' && message.trim().length > 0
        const hasImage = typeof imageDataUrl === 'string' && imageDataUrl.trim().length > 0
        if (!hasText && !hasImage) {
          sendUpdate({ type: "error", error: "Message or image is required" })
          controller.close()
          return
        }

        sendUpdate({ type: "status", message: "Processing your request..." })

        // Build conversation history
        const builtMessages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: any; tool_calls?: any; tool_call_id?: string }> = []
        
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
        builtMessages.push({ role: "system", content: systemContent })

        if (chatSessionId) {
          const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

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

            const MAX_MESSAGES = 100
            let trimmed = history
            
            if (history.length > MAX_MESSAGES) {
              const startIndex = history.length - MAX_MESSAGES
              let trimStartIndex = startIndex
              
              for (let i = startIndex; i < history.length; i++) {
                if (history[i].role === 'user') {
                  trimStartIndex = i
                  break
                }
              }
              
              trimmed = history.slice(trimStartIndex)
            }
            
            builtMessages.push(...trimmed)
          }
        }

        // Build user message, optionally multimodal with an image
        const fallbackText = "Please analyze the attached photo and extract foods and nutrition."
        const userText = (typeof message === 'string' && message.trim().length > 0) ? message : fallbackText
        let userMessageContent: any = userText
        if (imageDataUrl && typeof imageDataUrl === 'string') {
          userMessageContent = [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageDataUrl } }
          ]
        }
        builtMessages.push({ role: "user", content: userMessageContent } as any)

        // Save user message
        const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
        const savedUserMessage = await saveMessageToDb(
          chatSessionId,
          "user",
          imageDataUrl ? `${userText}\n[Image attached]` : userText,
          null,
          null
        )
        
        sendUpdate({ 
          type: "message", 
          message: {
            id: savedUserMessage?.id,
            role: "user",
            content: imageDataUrl ? `${userText}\n[Image attached]` : userText,
            toolCalls: null,
            toolCallId: null
          }
        })

        // Make initial LLM request
        const model = "google/gemini-2.0-flash-001"

        const requestPayload = {
          model,
          messages: builtMessages,
          tools: tools,
          temperature: 0.7,
          max_tokens: 1000,
        }

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
          let errBody: any = null
          try { errBody = await response.json() } catch { try { errBody = await response.text() } catch {}
          }
          const msg = formatOpenRouterError(response.status, response.statusText, errBody)
          const providerError = extractProviderError(errBody)
          console.error("OpenRouter initial request failed:", msg, providerError || "")
          sendUpdate({ type: "error", error: msg, providerError, details: errBody })
          controller.close()
          return
        }

        const data = await response.json()
        const aiMessage = data.choices[0]?.message

        if (!aiMessage) {
          throw new Error("No response from AI")
        }

        const result: any = { 
          foodAdded: null,
          foodUpdated: false,
          foodDeleted: false
        }

        // Handle multiple rounds of tool calling in a loop
        let currentMessage = aiMessage
        let roundCount = 0
        const maxRounds = 15
        
        while (roundCount < maxRounds) {
          const toolCalls = currentMessage?.tool_calls
          
          if (!toolCalls || toolCalls.length === 0) {
            // No more tool calls, save final assistant message
            if (currentMessage?.content) {
              const savedMessage = await saveMessageToDb(chatSessionId, "assistant", currentMessage.content, null, null)
              sendUpdate({ 
                type: "message", 
                message: {
                  id: savedMessage?.id,
                  role: "assistant",
                  content: currentMessage.content,
                  toolCalls: null,
                  toolCallId: null
                }
              })
            }
            break
          }

          // Save assistant message with tool calls
          const savedAssistantMessage = await saveMessageToDb(chatSessionId, "assistant", currentMessage.content || null, JSON.stringify(toolCalls), null)
          
          sendUpdate({ 
            type: "message", 
            message: {
              id: savedAssistantMessage?.id,
              role: "assistant",
              content: currentMessage.content || "",
              toolCalls: JSON.stringify(toolCalls),
              toolCallId: null
            }
          })

          // Add to conversation
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
            
            sendUpdate({ type: "status", message: `Executing ${name}...` })
            
            let toolResult = ""
            
            try {
              switch (name) {
                case 'add_food_entry': {
                  const entry = await addFoodEntry(userId, parsedArgs)
                  toolResult = `Successfully added ${parsedArgs.name} (${parsedArgs.quantity}) with ${parsedArgs.calories} calories to your food log.`
                  result.foodAdded = entry
                  break
                }
                case 'edit_food_entry': {
                  await editFoodEntry('', parsedArgs.id, parsedArgs)
                  toolResult = `Successfully updated food entry.`
                  result.foodUpdated = true
                  break
                }
                case 'delete_food_entry': {
                  await deleteFoodEntry('', parsedArgs.id)
                  toolResult = `Successfully deleted food entry.`
                  result.foodDeleted = true
                  break
                }
              }
            } catch (error) {
              toolResult = `Error executing ${name}: ${error}`
            }
            
            // Save tool message to database
            const savedToolMessage = await saveMessageToDb(chatSessionId, "tool", toolResult, null, toolCallId)
            
            // Send tool message update
            sendUpdate({ 
              type: "message", 
              message: {
                id: savedToolMessage?.id,
                role: "tool",
                content: toolResult,
                toolCalls: null,
                toolCallId: toolCallId
              }
            })

            // Send data change notification if needed
            if (result.foodAdded || result.foodUpdated || result.foodDeleted) {
              sendUpdate({ type: "data_changed", data: result })
            }
            
            toolMessages.push({
              role: "tool" as const,
              content: toolResult,
              tool_call_id: toolCallId
            })
          }
          
          // Add tool result messages to conversation
          builtMessages.push(...toolMessages)
          
          // Make follow-up request
          const followupPayload = {
            model,
            messages: builtMessages,
            tools: tools,
            temperature: 0.7,
            max_tokens: 1000,
          }

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
            let errBody: any = null
            try { errBody = await followupResponse.json() } catch { try { errBody = await followupResponse.text() } catch {}
            }
            const msg = formatOpenRouterError(followupResponse.status, followupResponse.statusText, errBody)
            const providerError = extractProviderError(errBody)
            console.error("OpenRouter follow-up request failed:", msg, providerError || "")
            sendUpdate({ type: "error", error: msg, providerError, details: errBody })
            controller.close()
            return
          }
          
          const followupData = await followupResponse.json()
          currentMessage = followupData.choices[0]?.message
          roundCount++
        }
        
        sendUpdate({ type: "completed" })

      } catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error)
        console.error("Error in streaming chat API:", msg)
        sendUpdate({ type: "error", error: msg })
      }
      
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
