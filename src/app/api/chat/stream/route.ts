import { authOptions } from "@/lib/auth"
import { DAILY_TARGETS } from "@/lib/constants"
import { db as prisma } from "@/lib/db"
import { addFoodEntry, deleteFoodEntry, editFoodEntry, getCurrentNutritionalData, getNutritionCacheItems, lookupNutritionalInfo, saveNutritionCacheItem } from "@/lib/food"
import { readFileSync } from "fs"
import { getServerSession } from "next-auth/next"
import { NextRequest } from "next/server"
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
  } catch (_error) {
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

function buildSystemPrompt(userTargets: { calories: number; protein: number; carbs: number; fat: number; fiber: number; salt: number }) {
  return `You are a helpful nutrition assistant for a calorie tracking app. Your main tasks are:

1. Help users log food by extracting nutritional information from their descriptions
2. Provide nutritional recommendations based on their daily targets
3. Answer nutrition-related questions
4. Help users edit or delete existing food entries

Daily targets:
- Calories: ${userTargets.calories} kcal
- Protein: ${userTargets.protein}g
- Fat: ${userTargets.fat}g
- Carbohydrates: ${userTargets.carbs}g
- Fiber: ${userTargets.fiber}g
- Salt: ${userTargets.salt}g

IMPORTANT: Always try to estimate calories and nutritional values when users describe food, even if they don't provide exact measurements. Use your knowledge of typical serving sizes and nutritional content. For example:
- "I had pizza" → estimate for 2-3 slices of typical pizza
- "ate some cookies" → estimate for 2-3 average cookies
- "had a sandwich" → estimate based on typical sandwich ingredients
- When given photos, analyze all visible food items and estimate portions

Be reasonable with estimates but always provide them rather than asking for more details. Users prefer estimates over no logging.

However, if estimation is not possible due to unfamiliar foods, specific branded products, complex restaurant dishes, or regional specialties you're not confident about, use the lookup_nutritional_info tool to get accurate data from web sources before logging the entry.

LOOKUP TOOL RETURN FORMAT: The lookup_nutritional_info tool returns the usual portion description and size in grams, plus nutritional values per 100g. When you receive this data, compute the calories and macros for the user's consumed amount (use their stated amount; if not provided, use the usual portion grams). Then call add_food_entry with the computed totals for the consumed quantity and a clear metric quantity string.

METRIC UNITS PREFERRED: Always use metric units (grams, ml, etc.) for quantities when possible. Convert imperial measurements to metric equivalents:
- "1 cup" → "240ml" or "240g" (depending on food type)
- "1 slice" → "80g" (for bread/pizza)
- "1 tbsp" → "15ml" or "15g"
- "1 oz" → "28g"
Use descriptive quantities like "1 medium apple (150g)" or "1 slice pizza (120g)" to be both clear and metric.

DATA RELIABILITY: When referencing existing entries (IDs, names) or daily totals, rely ONLY on the "Current food entries table" and "Current daily totals" provided in the system context below. Do NOT rely on prior assistant or user messages for IDs or totals, as they may be stale or incorrect.

You have access to the following tools:
- add_food_entry: Add new food entries to the log
- edit_food_entry: Edit existing food entries
- delete_food_entry: Delete food entries
- lookup_nutritional_info: Look up nutritional information for unfamiliar or complex foods

When users describe food they ate, use the add_food_entry tool. When they want to modify or remove entries, use the appropriate tools.`
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
          quantity: { type: "string", description: "Amount consumed in metric units when possible (e.g., 150g, 240ml, 1 medium apple 150g)" },
          calories: { type: "number", description: "Calories for the consumed quantity" },
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
          quantity: { type: "string", description: "New amount in metric units when possible" },
          calories: { type: "number", description: "New calories for the consumed quantity" },
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
  },
  {
    type: "function",
    function: {
      name: "lookup_nutritional_info",
      description: "Look up nutritional information for unfamiliar foods, branded products, or complex dishes using web search",
      parameters: {
        type: "object",
        properties: {
          foodDescription: { type: "string", description: "Description of the food item to look up (e.g., 'McDonald's Big Mac', 'Thai green curry', 'Ben & Jerry's Chunky Monkey ice cream')" }
        },
        required: ["foodDescription"]
      }
    }
  }
]

function dataUrlToInline(imageDataUrl: string): { data: string; mime_type: string } | null {
  try {
    if (!imageDataUrl || typeof imageDataUrl !== 'string') return null
    if (imageDataUrl.startsWith('encoded:')) {
      return { data: imageDataUrl.slice('encoded:'.length), mime_type: 'image/jpeg' }
    }
    const m = imageDataUrl.match(/^data:(.*?);base64,(.*)$/)
    if (!m) return null
    const mime_type = m[1]
    const data = m[2]
    return { data, mime_type }
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
        const { message, chatSessionId, imageDataUrl, date } = body

        const hasText = typeof message === 'string' && message.trim().length > 0
        const hasImage = typeof imageDataUrl === 'string' && imageDataUrl.trim().length > 0
        if (!hasText && !hasImage) {
          sendUpdate({ type: "error", error: "Message or image is required" })
          controller.close()
          return
        }

        if (!date) {
          sendUpdate({ type: "error", error: "Date parameter is required" })
          controller.close()
          return
        }

        sendUpdate({ type: "status", message: "Processing your request..." })

        // Get current user ID
        const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
        
        const user = await prisma.user.findUnique({ where: { id: userId } })
        const userTargets = {
          calories: user?.targetCalories ?? DAILY_TARGETS.calories,
          protein: user?.targetProtein ?? DAILY_TARGETS.protein,
          carbs: user?.targetCarbs ?? DAILY_TARGETS.carbs,
          fat: user?.targetFat ?? DAILY_TARGETS.fat,
          fiber: user?.targetFiber ?? DAILY_TARGETS.fiber,
          salt: user?.targetSalt ?? DAILY_TARGETS.salt,
        }
        
        // Ensure date is a Date object
        const targetDate = new Date(date)
        const { totals, foodEntries: currentFoodEntries } = await getCurrentNutritionalData(userId, targetDate)
        const cacheItems = await getNutritionCacheItems(userId, 30)

        // Build conversation history
        const builtMessages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: any; tool_calls?: any; tool_call_id?: string }> = []
        
        let contextMessage = ""
        if (totals) {
          contextMessage = "Current daily totals: " + totals.calories + " calories, " + 
                          totals.protein + "g protein, " + totals.carbs + "g carbs, " + 
                          totals.fat + "g fat, " + totals.fiber + "g fiber, " +
                          totals.salt + "g salt."
        }
        
        let foodEntriesContext = "No food entries logged today yet."
        if (currentFoodEntries && currentFoodEntries.length > 0) {
          const tableHeader = "Current food entries table:"
          const tableRows = currentFoodEntries.map((entry: any, index: number) => 
            `${index + 1}. ${entry.name} (${entry.quantity}) - ID: ${entry.id}\n   Macros: ${entry.calories} kcal, ${entry.protein}g protein, ${entry.carbs}g carbs, ${entry.fat}g fat, ${entry.fiber}g fiber, ${entry.salt}g salt`
          ).join('\n')
          foodEntriesContext = `${tableHeader}\n${tableRows}`
        }

        // Build nutrition cache context
        let cacheContext = ""
        if (cacheItems && cacheItems.length > 0) {
          const header = "Known nutrition cache entries (per 100g):"
          const rows = cacheItems.map((c: any, i: number) => {
            const p = `cal ${Math.round(c.caloriesPer100g)} kcal, prot ${Number(c.proteinPer100g).toFixed(1)}g, carbs ${Number(c.carbsPer100g).toFixed(1)}g, fat ${Number(c.fatPer100g).toFixed(1)}g, fiber ${Number(c.fiberPer100g).toFixed(1)}g, salt ${Number(c.saltPer100g).toFixed(2)}g`
            const portion = `${Math.round(c.portionSizeGrams)}g (${c.portionDescription})`
            return `${i + 1}. ${c.name} — usual portion ${portion}; per100g: ${p}`
          }).join('\n')
          cacheContext = `${header}\n${rows}`
        }

        const systemContent = buildSystemPrompt(userTargets) + (contextMessage ? "\n\n" + contextMessage + "\n\n" + foodEntriesContext : "\n\n" + foodEntriesContext) + (cacheContext ? "\n\n" + cacheContext : "")
        builtMessages.push({ role: "system", content: systemContent })

        if (chatSessionId) {
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
          const inline = dataUrlToInline(imageDataUrl)
          if (inline) {
            userMessageContent = [
              { type: "input_text", text: userText },
              { type: "input_image", inline_data: { mime_type: inline.mime_type, data: inline.data } }
            ]
          } else {
            userMessageContent = [
              { type: "input_text", text: userText },
              { type: "input_image", image_url: imageDataUrl }
            ]
          }
        }
        builtMessages.push({ role: "user", content: userMessageContent } as any)

        // Save user message
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
        const model = "google/gemini-2.5-flash"

        const requestPayload = {
          model,
          messages: builtMessages,
          tools: tools,
          temperature: 0.7,
          max_tokens: 1000,
        }

        console.log("=== LLM REQUEST (STREAMING) ===")
        console.log("Timestamp:", new Date().toISOString())
        console.log("Chat Session ID:", chatSessionId)
        console.log("User Message:", message)
        console.log("System Message:", systemContent)
        console.log("Full Messages Array:", JSON.stringify(builtMessages, null, 2))
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
          foodAdded: null as any,
          foodUpdated: null as any,
          foodDeleted: null as string | null
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
            // Reset data change result for this specific tool call
            result.foodAdded = null
            result.foodUpdated = null
            result.foodDeleted = null
            const { id: toolCallId, function: { name, arguments: args } } = toolCall
            const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
            
            sendUpdate({ type: "status", message: `Executing ${name}...` })
            
            let toolResult = ""
            
            try {
              switch (name) {
                case 'add_food_entry': {
                  const entry = await addFoodEntry(userId, { ...parsedArgs, date })
                  toolResult = `Successfully added ${parsedArgs.name} (${parsedArgs.quantity}) with ${parsedArgs.calories} calories to your food log.`
                  result.foodAdded = entry
                  break
                }
                case 'edit_food_entry': {
                  const updated = await editFoodEntry(userId, parsedArgs.id, parsedArgs)
                  toolResult = `Successfully updated food entry.`
                  result.foodUpdated = updated
                  break
                }
                case 'delete_food_entry': {
                  await deleteFoodEntry(userId, parsedArgs.id)
                  toolResult = `Successfully deleted food entry.`
                  result.foodDeleted = parsedArgs.id
                  break
                }
                case 'lookup_nutritional_info': {
                  const nutritionalInfo = await lookupNutritionalInfo(parsedArgs.foodDescription)
                  // Save to per-user cache
                  try {
                    await saveNutritionCacheItem(userId, parsedArgs.foodDescription, nutritionalInfo)
                  } catch (e) {
                    console.error('Failed to cache nutritional info', e)
                  }
                  toolResult = `Found nutritional information: ${JSON.stringify(nutritionalInfo)}`
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

          console.log("=== FOLLOW-UP REQUEST ===")
          console.log("Timestamp:", new Date().toISOString())
          console.log("Round:", roundCount + 1)
          console.log("Follow-up Messages Array:", JSON.stringify(builtMessages, null, 2))
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
