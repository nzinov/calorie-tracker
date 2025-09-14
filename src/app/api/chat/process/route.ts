import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { DAILY_TARGETS } from "@/lib/constants"
import { db as prisma } from "@/lib/db"
import { addFoodEntry, deleteFoodEntry, editFoodEntry, getCurrentNutritionalData, getNutritionCacheItems, lookupNutritionalInfo, saveNutritionCacheItem } from "@/lib/food"
import { createChatEvent } from "@/lib/events"

// Reuse the helper shape from stream route (local copy to avoid refactor)
async function saveMessageToDb(chatSessionId: string, role: string, content: string | null, toolCalls: string | null, toolCallId: string | null) {
  if (!chatSessionId) return null
  const message = await prisma.chatMessage.create({
    data: { role, content: content || "", chatSessionId, toolCalls, toolCallId }
  })
  return message
}

function buildSystemPrompt(userTargets: { calories: number; protein: number; carbs: number; fat: number; fiber: number; salt: number }) {
  return `You are a helpful nutrition assistant for a calorie tracking app. Your main tasks are:\n\n1. Help users log food by extracting nutritional information from their descriptions\n2. Provide nutritional recommendations based on their daily targets\n3. Answer nutrition-related questions\n4. Help users edit or delete existing food entries\n\nDaily targets:\n- Calories: ${userTargets.calories} kcal\n- Protein: ${userTargets.protein}g\n- Fat: ${userTargets.fat}g\n- Carbohydrates: ${userTargets.carbs}g\n- Fiber: ${userTargets.fiber}g\n- Salt: ${userTargets.salt}g\n\nIMPORTANT: Always try to estimate calories and nutritional values when users describe food, even if they don't provide exact measurements. Use your knowledge of typical serving sizes and nutritional content. For example:\n- \"I had pizza\" → estimate for 2-3 slices of typical pizza\n- \"ate some cookies\" → estimate for 2-3 average cookies\n- \"had a sandwich\" → estimate based on typical sandwich ingredients\n- When given photos, analyze all visible food items and estimate portions\n\nBe reasonable with estimates but always provide them rather than asking for more details. Users prefer estimates over no logging.\n\nHowever, if estimation is not possible due to unfamiliar foods, specific branded products, complex restaurant dishes, or regional specialties you're not confident about, use the lookup_nutritional_info tool to get accurate data from web sources before logging the entry.\n\nLOOKUP TOOL RETURN FORMAT: The lookup_nutritional_info tool returns the usual portion description and size in grams, plus nutritional values per 100g. When you receive this data, compute the calories and macros for the user's consumed amount (use their stated amount; if not provided, use the usual portion grams). Then call add_food_entry with the computed totals for the consumed quantity and a clear metric quantity string.\n\nMETRIC UNITS PREFERRED: Always use metric units (grams, ml, etc.) for quantities when possible. Convert imperial measurements to metric equivalents:\n- \"1 cup\" → \"240ml\" or \"240g\" (depending on food type)\n- \"1 slice\" → \"80g\" (for bread/pizza)\n- \"1 tbsp\" → \"15ml\" or \"15g\"\n- \"1 oz\" → \"28g\"\nUse descriptive quantities like \"1 medium apple (150g)\" or \"1 slice pizza (120g)\" to be both clear and metric.\n\nDATA RELIABILITY: When referencing existing entries (IDs, names) or daily totals, rely ONLY on the \"Current food entries table\" and \"Current daily totals\" provided in the system context below. Do NOT rely on prior assistant or user messages for IDs or totals, as they may be stale or incorrect.\n\nYou have access to the following tools:\n- add_food_entry: Add new food entries to the log\n- edit_food_entry: Edit existing food entries\n- delete_food_entry: Delete food entries\n- lookup_nutritional_info: Look up nutritional information for unfamiliar or complex foods\n\nWhen users describe food they ate, use the add_food_entry tool. When they want to modify or remove entries, use the appropriate tools.`
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

let cachedApiKey: string | null = null
function getOpenRouterApiKey(): string {
  if (cachedApiKey) return cachedApiKey
  if (process.env.OPENROUTER_API_KEY) { cachedApiKey = process.env.OPENROUTER_API_KEY; return cachedApiKey }
  try {
    const tokenPath = join(homedir(), '.openrouter.token')
    const token = readFileSync(tokenPath, 'utf8').trim()
    cachedApiKey = token
    return token
  } catch {
    throw new Error('OPENROUTER_API_KEY not found in environment or ~/.openrouter.token file')
  }
}

function extractProviderError(body: any): string | null {
  try {
    if (!body) return null
    if (typeof body === 'string') return null
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

// No image decoding needed; we pass data URLs via image_url { url }

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, chatSessionId, imageDataUrl, date } = body

    if (!chatSessionId) return NextResponse.json({ error: 'chatSessionId is required' }, { status: 400 })
    if (!date) return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 })
    const hasText = typeof message === 'string' && message.trim().length > 0
    const hasImage = typeof imageDataUrl === 'string' && imageDataUrl.trim().length > 0
    if (!hasText && !hasImage) {
      return NextResponse.json({ error: 'Message or image is required' }, { status: 400 })
    }

    // Respond early; processing continues
    const response = NextResponse.json({ accepted: true })

    // Begin background processing (best-effort in this environment)
    ;(async () => {
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

      const targetDate = new Date(date)
      const { totals, foodEntries: currentFoodEntries } = await getCurrentNutritionalData(userId, targetDate)
      const cacheItems = await getNutritionCacheItems(userId, 30)

      // Build system + context message
      const systemContent = buildSystemPrompt(userTargets) + (totals
        ? "\n\n" + ("Current daily totals: " + totals.calories + " calories, " + totals.protein + "g protein, " + totals.carbs + "g carbs, " + totals.fat + "g fat, " + totals.fiber + "g fiber, " + totals.salt + "g salt.")
        : '') + "\n\n" + ((currentFoodEntries && currentFoodEntries.length > 0)
        ? ("Current food entries table:\n" + currentFoodEntries.map((entry: any, index: number) => `${index + 1}. ${entry.name} (${entry.quantity}) - ID: ${entry.id}\n   Macros: ${entry.calories} kcal, ${entry.protein}g protein, ${entry.carbs}g carbs, ${entry.fat}g fat, ${entry.fiber}g fiber, ${entry.salt}g salt`).join('\n'))
        : 'No food entries logged today yet.') + (cacheItems && cacheItems.length > 0
        ? ("\n\nKnown nutrition cache entries (per 100g):\n" + cacheItems.map((c: any, i: number) => {
            const p = `cal ${Math.round(c.caloriesPer100g)} kcal, prot ${Number(c.proteinPer100g).toFixed(1)}g, carbs ${Number(c.carbsPer100g).toFixed(1)}g, fat ${Number(c.fatPer100g).toFixed(1)}g, fiber ${Number(c.fiberPer100g).toFixed(1)}g, salt ${Number(c.saltPer100g).toFixed(2)}g`
            const portion = `${Math.round(c.portionSizeGrams)}g (${c.portionDescription})`
            return `${i + 1}. ${c.name} — usual portion ${portion}; per100g: ${p}`
          }).join('\n')) : '')

      // Prepare first AI request (mirror original stream route behavior)
      const fallbackText = "Please analyze the attached photo and extract foods and nutrition."
      const userText = hasText ? String(message) : (hasImage ? fallbackText : '')
      const uiContent = hasImage ? `${userText}${userText ? '\n' : ''}[Image attached]` : userText
      const builtMessages: Array<any> = []
      builtMessages.push({ role: 'system', content: systemContent })

      // Include prior chat history for this session
      const chatSession = await prisma.chatSession.findFirst({
        where: { id: chatSessionId, dailyLog: { userId } },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
            select: { id: true, role: true, content: true, timestamp: true, toolCalls: true, toolCallId: true }
          }
        }
      })
      if (chatSession) {
        const history: Array<any> = []
        chatSession.messages.forEach((m) => {
          if (m.role === 'user') {
            history.push({ role: 'user', content: m.content || '' })
          } else if (m.role === 'assistant') {
            const msg: any = { role: 'assistant', content: m.content || '' }
            if (m.toolCalls) {
              try { msg.tool_calls = JSON.parse(m.toolCalls) } catch {}
            }
            history.push(msg)
          } else if (m.role === 'tool') {
            history.push({ role: 'tool', content: m.content || '', tool_call_id: m.toolCallId || '' })
          }
        })
        const MAX_MESSAGES = 100
        let trimmed = history
        if (history.length > MAX_MESSAGES) {
          const startIndex = history.length - MAX_MESSAGES
          let trimStartIndex = startIndex
          for (let i = startIndex; i < history.length; i++) {
            if (history[i].role === 'user') { trimStartIndex = i; break }
          }
          trimmed = history.slice(trimStartIndex)
        }
        builtMessages.push(...trimmed)
      }

      // Build user message content with OpenRouter content-part schema
      // Use text + image_url with nested { url: data_url }
      let userMessageContent: any = userText
      if (hasImage && typeof imageDataUrl === 'string') {
        userMessageContent = [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }
      builtMessages.push({ role: 'user', content: userMessageContent } as any)

      // Persist user message and emit event (after building messages to avoid duplicating it in history)
      const savedUserMessage = await saveMessageToDb(chatSessionId, 'user', uiContent, null, null)
      await createChatEvent(chatSessionId, 'message', { type: 'message', message: { id: savedUserMessage?.id, role: 'user', content: uiContent, toolCalls: null, toolCallId: null } })

      const tools = [
        { type: 'function', function: { name: 'add_food_entry', description: 'Add a new food entry to today\'s log', parameters: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'string' }, calories: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' }, fiber: { type: 'number' }, salt: { type: 'number' } }, required: ['name','quantity','calories','protein','carbs','fat','fiber','salt'] } } },
        { type: 'function', function: { name: 'edit_food_entry', description: 'Edit an existing food entry', parameters: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, quantity: { type: 'string' }, calories: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' }, fiber: { type: 'number' }, salt: { type: 'number' } }, required: ['id'] } } },
        { type: 'function', function: { name: 'delete_food_entry', description: 'Delete a food entry from today\'s log', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } } },
        { type: 'function', function: { name: 'lookup_nutritional_info', description: 'Look up nutritional information using web search', parameters: { type: 'object', properties: { foodDescription: { type: 'string' } }, required: ['foodDescription'] } } },
      ]

      const model = 'google/gemini-2.5-flash'

      const requestPayload = { model, messages: builtMessages, tools, temperature: 0.7, max_tokens: 1000 }

      await createChatEvent(chatSessionId, 'status', { type: 'status', message: 'Processing your request...' })

      // Log full initial request to OpenRouter (sanitized)
      try {
        console.log("=== LLM REQUEST (BG PROCESS) ===")
        console.log("Timestamp:", new Date().toISOString())
        console.log("Chat Session ID:", chatSessionId)
        console.log("User Message:", uiContent)
        console.log("System Message:", systemContent)
        console.log("Full Messages Array:", JSON.stringify(builtMessages, null, 2))
        console.log("Request Payload:", JSON.stringify({ ...requestPayload, api_key: undefined }, null, 2))
      } catch {}

      const resp = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + getOpenRouterApiKey(),
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'Calorie Tracker App',
        },
        body: JSON.stringify(requestPayload),
      })

      if (!resp.ok) {
        let errBody: any = null
        try { errBody = await resp.json() } catch { try { errBody = await resp.text() } catch {} }
        const providerError = extractProviderError(errBody)
        await createChatEvent(chatSessionId, 'error', { type: 'error', error: `OpenRouter error ${resp.status} ${resp.statusText}`, providerError, details: errBody })
        await createChatEvent(chatSessionId, 'completed', { type: 'completed' })
        return
      }

      // Log response meta
      try {
        console.log("[BG] OpenRouter status:", resp.status, resp.statusText)
        const hdrs: Record<string, string> = {}
        resp.headers.forEach((v, k) => { hdrs[k] = v })
        console.log("[BG] OpenRouter headers:", JSON.stringify(hdrs, null, 2))
      } catch {}

      const data = await resp.json()
      try { console.log("[BG] OpenRouter response body:", JSON.stringify(data, null, 2)) } catch {}
      let currentMessage = data.choices?.[0]?.message
      if (!currentMessage) {
        await createChatEvent(chatSessionId, 'error', { type: 'error', error: 'No response from AI' })
        await createChatEvent(chatSessionId, 'completed', { type: 'completed' })
        return
      }

      const result: any = { foodAdded: null, foodUpdated: null, foodDeleted: null }
      let roundCount = 0
      const maxRounds = 15

      while (roundCount < maxRounds) {
        const toolCalls = currentMessage?.tool_calls
        if (!toolCalls || toolCalls.length === 0) {
          if (currentMessage?.content) {
            const saved = await saveMessageToDb(chatSessionId, 'assistant', currentMessage.content, null, null)
            await createChatEvent(chatSessionId, 'message', { type: 'message', message: { id: saved?.id, role: 'assistant', content: currentMessage.content, toolCalls: null, toolCallId: null } })
          }
          break
        }

        const savedAssistant = await saveMessageToDb(chatSessionId, 'assistant', currentMessage.content || null, JSON.stringify(toolCalls), null)
        await createChatEvent(chatSessionId, 'message', { type: 'message', message: { id: savedAssistant?.id, role: 'assistant', content: currentMessage.content || '', toolCalls: JSON.stringify(toolCalls), toolCallId: null } })
        // Add assistant with tool calls to conversation
        builtMessages.push({ role: 'assistant', content: currentMessage.content, tool_calls: toolCalls } as any)

        const toolMessages = [] as any[]
        for (const toolCall of toolCalls) {
          result.foodAdded = null
          result.foodUpdated = null
          result.foodDeleted = null
          const { id: toolCallId, function: { name, arguments: args } } = toolCall
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
          await createChatEvent(chatSessionId, 'status', { type: 'status', message: `Executing ${name}...` })
          let toolResult = ''
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
                try { await saveNutritionCacheItem(userId, parsedArgs.foodDescription, nutritionalInfo) } catch {}
                toolResult = `Found nutritional information: ${JSON.stringify(nutritionalInfo)}`
                break
              }
              default:
                toolResult = `Unknown tool: ${name}`
            }
          } catch (e) {
            toolResult = `Error executing ${name}: ${e}`
          }

          const savedTool = await saveMessageToDb(chatSessionId, 'tool', toolResult, null, toolCallId)
          await createChatEvent(chatSessionId, 'message', { type: 'message', message: { id: savedTool?.id, role: 'tool', content: toolResult, toolCalls: null, toolCallId: toolCallId } })
          if (result.foodAdded || result.foodUpdated || result.foodDeleted) {
            await createChatEvent(chatSessionId, 'data_changed', { type: 'data_changed', data: result })
          }

          toolMessages.push({ role: 'tool', content: toolResult, tool_call_id: toolCallId })
        }

        // Add tool results to conversation and request next round
        builtMessages.push(...toolMessages)
        const followupPayload = { model, messages: builtMessages, tools, temperature: 0.7, max_tokens: 1000 }

        // Log follow-up request payload
        try {
          console.log("=== FOLLOW-UP REQUEST (BG) ===")
          console.log("Timestamp:", new Date().toISOString())
          console.log("Round:", roundCount + 1)
          console.log("Follow-up Messages Array:", JSON.stringify(builtMessages, null, 2))
          console.log("Follow-up Payload:", JSON.stringify({ model, temperature: 0.7, max_tokens: 1000, tools }, null, 2))
        } catch {}

        const follow = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + getOpenRouterApiKey(),
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3001',
            'X-Title': 'Calorie Tracker App',
          },
          body: JSON.stringify(followupPayload),
        })
        if (!follow.ok) {
          let errBody: any = null
          try { errBody = await follow.json() } catch { try { errBody = await follow.text() } catch {} }
          const providerError = extractProviderError(errBody)
          await createChatEvent(chatSessionId, 'error', { type: 'error', error: `OpenRouter error ${follow.status} ${follow.statusText}`, providerError, details: errBody })
          await createChatEvent(chatSessionId, 'completed', { type: 'completed' })
          return
        }
        try {
          console.log("[BG] Follow-up status:", follow.status, follow.statusText)
          const fh: Record<string, string> = {}
          follow.headers.forEach((v, k) => { fh[k] = v })
          console.log("[BG] Follow-up headers:", JSON.stringify(fh, null, 2))
        } catch {}
        const followData = await follow.json()
        try { console.log("[BG] Follow-up response body:", JSON.stringify(followData, null, 2)) } catch {}
        currentMessage = followData.choices?.[0]?.message
        roundCount++
      }

      await createChatEvent(chatSessionId, 'completed', { type: 'completed' })
    })().catch(async (e) => {
      console.error('Background processing failed', e)
    })

    return response
  } catch (error) {
    console.error('Error in chat processing route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
