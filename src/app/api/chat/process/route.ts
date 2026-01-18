import { authOptions } from "@/lib/auth"
import { DAILY_TARGETS } from "@/lib/constants"
import { db as prisma } from "@/lib/db"
import { createChatEvent } from "@/lib/events"
import { webSearch } from "@/lib/food"
import { readFileSync } from "fs"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"
import { homedir } from "os"
import { join } from "path"

// Reuse the helper shape from stream route (local copy to avoid refactor)
async function saveMessageToDb(chatSessionId: string, role: string, content: string | null, toolCalls: string | null, toolCallId: string | null) {
  if (!chatSessionId) return null
  const message = await prisma.chatMessage.create({
    data: { role, content: content || "", chatSessionId, toolCalls, toolCallId }
  })
  return message
}

function buildSystemPrompt(userTargets: { calories: number; protein: number; carbs: number; fat: number; fiber: number; salt: number }) {
  return `You are a helpful nutrition assistant for a calorie tracking app. You need to add/edit/delete food items in the user's daily meal plan.

Daily targets:
- Calories: ${userTargets.calories} kcal
- Protein: ${userTargets.protein}g
- Fat: ${userTargets.fat}g
- Carbohydrates: ${userTargets.carbs}g
- Fiber: ${userTargets.fiber}g
- Salt: ${userTargets.salt}g

## How Food Logging Works

The user has a personal FOOD DATABASE containing foods they've logged before. Each food in the database has:
- An ID (use this to reference the food)
- Name
- Nutritional values per 100g
- Optional default portion size in grams
- Optional comments (portion info, notes, etc.) Do not add obvious comments, only use them if necessary

When logging food:
1. First check if the food exists in the user's database (shown below)
2. If it exists, use add_food_entry with the food's ID and the amount in grams
3. If it doesn't exist, first use create_food to add it to the database, then use add_food_entry with the new food's ID

IMPORTANT: Always try to estimate calories and nutritional values when users describe food, even if they don't provide exact measurements. Use your knowledge of typical serving sizes and nutritional content. For example:
- "I had pizza" → estimate for 2-3 slices of typical pizza
- "add some cookies" → estimate for 2-3 average cookies
- "had a sandwich" → estimate based on typical sandwich ingredients
- When given photos, analyze all visible food items and estimate portions

Be reasonable with estimates but always provide them rather than asking for more details. Users prefer estimates over no logging. Do not ask for confirmations of your actions unless absolutely necessary.

If a food is not in the database and you need information from the web to estimate its nutritional values (e.g. it's some specific brand), use the web_search tool to get accurate data from web sources before creating the food.

METRIC UNITS PREFERRED: Always use metric units (grams, ml, etc.) for quantities when possible.

IMPORTANT: DO NOT repeat nutritional information of the food after you add it and DO NOT mention total macros of the day unless user explicitly asks you. User can see them in the UI.

If the user asks you what to eat, go off remaining nnutritional targets for the day and healthy eating guidelines.

`
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
      const dateStr = date  // Keep the original date string for comparison

      // Get user's food database instead of cache
      const userFoods = await prisma.userFood.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 50
      })

      // Build system + context message with food database
      const systemContent = buildSystemPrompt(userTargets) + (userFoods && userFoods.length > 0
        ? ("\n\n## User's Food Database (reference by ID when adding entries):\n" + userFoods.map((f: any, i: number) => {
            const macros = `cal ${Math.round(f.caloriesPer100g)}, prot ${Number(f.proteinPer100g).toFixed(1)}g, carbs ${Number(f.carbsPer100g).toFixed(1)}g, fat ${Number(f.fatPer100g).toFixed(1)}g, fiber ${Number(f.fiberPer100g).toFixed(1)}g, salt ${Number(f.saltPer100g).toFixed(2)}g`
            const defaultPortion = f.defaultGrams ? ` (default: ${Math.round(f.defaultGrams)}g)` : ''
            const comments = f.comments ? ` — ${f.comments}` : ''
            return `${i + 1}. [ID: ${f.id}] ${f.name}${defaultPortion} — per 100g: ${macros}${comments}`
          }).join('\n'))
        : '\n\n## User\'s Food Database is empty. Use create_food to add new foods before logging entries.')

      // Prepare first AI request (mirror original stream route behavior)
      const fallbackText = "Please analyze the attached photo and extract foods and nutrition."
      const userText = hasText ? String(message) : (hasImage ? fallbackText : '')
      const uiContent = hasImage ? `${userText}${userText ? '\n' : ''}[Image attached]` : userText
      const builtMessages: Array<any> = []
      builtMessages.push({ role: 'system', content: systemContent })

      // Include prior chat history for this session
      const chatSession = await prisma.chatSession.findFirst({
        where: { id: chatSessionId, userId },
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
      let userMessageContent: any = userText
      if (hasImage && typeof imageDataUrl === 'string') {
        userMessageContent = [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }
      builtMessages.push({ role: 'user', content: userMessageContent } as any)

      // Persist user message and emit event
      const savedUserMessage = await saveMessageToDb(chatSessionId, 'user', uiContent, null, null)
      await createChatEvent(chatSessionId, 'message', { type: 'message', message: { id: savedUserMessage?.id, role: 'user', content: uiContent, toolCalls: null, toolCallId: null } })

      const tools = [
        // Create a new food in user's database
        {
          type: 'function',
          function: {
            name: 'create_food',
            description: 'Add a new food to the user\'s food database. Use this when the food doesn\'t exist in the database yet.',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name of the food' },
                caloriesPer100g: { type: 'number', description: 'Calories per 100g' },
                proteinPer100g: { type: 'number', description: 'Protein in grams per 100g' },
                carbsPer100g: { type: 'number', description: 'Carbohydrates in grams per 100g' },
                fatPer100g: { type: 'number', description: 'Fat in grams per 100g' },
                fiberPer100g: { type: 'number', description: 'Fiber in grams per 100g' },
                saltPer100g: { type: 'number', description: 'Salt in grams per 100g' },
                defaultGrams: { type: 'number', description: 'Default portion size in grams (optional)' },
                comments: { type: 'string', description: 'Additional notes like portion descriptions, brand info, etc. (optional, you can leave it empty)' }
              },
              required: ['name', 'caloriesPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g', 'fiberPer100g', 'saltPer100g']
            }
          }
        },
        // Update an existing food in user's database
        {
          type: 'function',
          function: {
            name: 'update_food',
            description: 'Update an existing food in the user\'s food database. Use the food ID from the database.',
            parameters: {
              type: 'object',
              properties: {
                foodId: { type: 'string', description: 'The ID of the food to update' },
                name: { type: 'string', description: 'New name (optional)' },
                caloriesPer100g: { type: 'number', description: 'Calories per 100g (optional)' },
                proteinPer100g: { type: 'number', description: 'Protein in grams per 100g (optional)' },
                carbsPer100g: { type: 'number', description: 'Carbohydrates in grams per 100g (optional)' },
                fatPer100g: { type: 'number', description: 'Fat in grams per 100g (optional)' },
                fiberPer100g: { type: 'number', description: 'Fiber in grams per 100g (optional)' },
                saltPer100g: { type: 'number', description: 'Salt in grams per 100g (optional)' },
                defaultGrams: { type: 'number', description: 'Default portion size in grams (optional)' },
                comments: { type: 'string', description: 'Additional notes (optional)' }
              },
              required: ['foodId']
            }
          }
        },
        // Add a food entry to daily log
        {
          type: 'function',
          function: {
            name: 'add_food_entry',
            description: 'Add a food entry to the user\'s daily log. The food must already exist in the database - use its ID.',
            parameters: {
              type: 'object',
              properties: {
                userFoodId: { type: 'string', description: 'The ID of the food from the user\'s database' },
                grams: { type: 'number', description: 'Amount consumed in grams' }
              },
              required: ['userFoodId', 'grams']
            }
          }
        },
        // Edit a food entry (change grams and/or nutritional info)
        {
          type: 'function',
          function: {
            name: 'edit_food_entry',
            description: 'Edit an existing food entry. Can change the amount consumed and/or update the nutritional information of the underlying food.',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'The ID of the food entry to edit' },
                grams: { type: 'number', description: 'New amount in grams (optional)' },
                caloriesPer100g: { type: 'number', description: 'Updated calories per 100g (optional)' },
                proteinPer100g: { type: 'number', description: 'Updated protein in grams per 100g (optional)' },
                carbsPer100g: { type: 'number', description: 'Updated carbohydrates in grams per 100g (optional)' },
                fatPer100g: { type: 'number', description: 'Updated fat in grams per 100g (optional)' },
                fiberPer100g: { type: 'number', description: 'Updated fiber in grams per 100g (optional)' },
                saltPer100g: { type: 'number', description: 'Updated salt in grams per 100g (optional)' }
              },
              required: ['id']
            }
          }
        },
        // Delete a food entry
        {
          type: 'function',
          function: {
            name: 'delete_food_entry',
            description: 'Delete a food entry from today\'s log',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'The ID of the food entry to delete' }
              },
              required: ['id']
            }
          }
        },
        // Web search for information
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for information. Use for looking up nutritional info, brands, or any other factual data.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' }
              },
              required: ['query']
            }
          }
        },
      ]

      const model = 'google/gemini-3-flash-preview'

      const requestPayload = { model, messages: builtMessages, tools, temperature: 0.3, reasoning: { effort: 'low' } }

      await createChatEvent(chatSessionId, 'status', { type: 'status', message: 'Processing your request...' })


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

      const data = await resp.json()
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

          // Helper to get current nutritional context
          const generateNutritionalContext = async () => {
            const startDate = new Date(date)
            startDate.setHours(0, 0, 0, 0)
            const endDate = new Date(date)
            endDate.setHours(23, 59, 59, 999)

            const foodEntries = await prisma.foodEntry.findMany({
              where: { userId, date: { gte: startDate, lte: endDate } },
              include: { userFood: true },
              orderBy: { timestamp: 'asc' }
            })

            const totals = foodEntries.reduce(
              (acc, entry) => {
                const ratio = entry.grams / 100
                return {
                  calories: acc.calories + (entry.userFood.caloriesPer100g * ratio),
                  protein: acc.protein + (entry.userFood.proteinPer100g * ratio),
                  carbs: acc.carbs + (entry.userFood.carbsPer100g * ratio),
                  fat: acc.fat + (entry.userFood.fatPer100g * ratio),
                  fiber: acc.fiber + (entry.userFood.fiberPer100g * ratio),
                  salt: acc.salt + (entry.userFood.saltPer100g * ratio),
                }
              },
              { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 }
            )

            const totalsStr = `Current daily totals: ${Math.round(totals.calories)} calories, ${totals.protein.toFixed(1)}g protein, ${totals.carbs.toFixed(1)}g carbs, ${totals.fat.toFixed(1)}g fat, ${totals.fiber.toFixed(1)}g fiber, ${totals.salt.toFixed(2)}g salt.`

            let entriesStr = ''
            if (foodEntries.length > 0) {
              entriesStr = `Current food entries:\n` + foodEntries.map((entry: any, index: number) => {
                const ratio = entry.grams / 100
                const cals = Math.round(entry.userFood.caloriesPer100g * ratio)
                return `${index + 1}. ${entry.userFood.name} (${entry.grams}g, ${cals} kcal) - Entry ID: ${entry.id}`
              }).join('\n')
            }

            return { totalsStr, entriesStr, foodEntries }
          }

          const formatFoodOperationResult = async (message: string) => {
            const { totalsStr, entriesStr } = await generateNutritionalContext()
            return `${message}\n\n${totalsStr}${entriesStr ? `\n${entriesStr}` : ''}`
          }

          try {
            switch (name) {
              case 'create_food': {
                const newFood = await prisma.userFood.create({
                  data: {
                    userId,
                    name: parsedArgs.name,
                    caloriesPer100g: Number(parsedArgs.caloriesPer100g),
                    proteinPer100g: Number(parsedArgs.proteinPer100g),
                    carbsPer100g: Number(parsedArgs.carbsPer100g),
                    fatPer100g: Number(parsedArgs.fatPer100g),
                    fiberPer100g: Number(parsedArgs.fiberPer100g),
                    saltPer100g: Number(parsedArgs.saltPer100g),
                    defaultGrams: parsedArgs.defaultGrams ? Number(parsedArgs.defaultGrams) : null,
                    comments: parsedArgs.comments || null
                  }
                })
                toolResult = `Added "${newFood.name}" to your food database.\nFood ID: ${newFood.id}. You can now use add_food_entry with this ID.`
                result.userFoodCreated = newFood
                break
              }
              case 'update_food': {
                const existingFood = await prisma.userFood.findFirst({
                  where: { id: parsedArgs.foodId, userId }
                })
                if (!existingFood) {
                  toolResult = `Error: Food not found in database.`
                } else {
                  const updated = await prisma.userFood.update({
                    where: { id: parsedArgs.foodId },
                    data: {
                      ...(parsedArgs.name !== undefined ? { name: parsedArgs.name } : {}),
                      ...(parsedArgs.caloriesPer100g !== undefined ? { caloriesPer100g: Number(parsedArgs.caloriesPer100g) } : {}),
                      ...(parsedArgs.proteinPer100g !== undefined ? { proteinPer100g: Number(parsedArgs.proteinPer100g) } : {}),
                      ...(parsedArgs.carbsPer100g !== undefined ? { carbsPer100g: Number(parsedArgs.carbsPer100g) } : {}),
                      ...(parsedArgs.fatPer100g !== undefined ? { fatPer100g: Number(parsedArgs.fatPer100g) } : {}),
                      ...(parsedArgs.fiberPer100g !== undefined ? { fiberPer100g: Number(parsedArgs.fiberPer100g) } : {}),
                      ...(parsedArgs.saltPer100g !== undefined ? { saltPer100g: Number(parsedArgs.saltPer100g) } : {}),
                      ...(parsedArgs.defaultGrams !== undefined ? { defaultGrams: parsedArgs.defaultGrams ? Number(parsedArgs.defaultGrams) : null } : {}),
                      ...(parsedArgs.comments !== undefined ? { comments: parsedArgs.comments || null } : {})
                    }
                  })
                  toolResult = `Updated "${updated.name}" in your food database.`
                }
                break
              }
              case 'add_food_entry': {
                const food = await prisma.userFood.findFirst({
                  where: { id: parsedArgs.userFoodId, userId }
                })
                if (!food) {
                  toolResult = `Error: Food not found in database. Please create it first using create_food.`
                } else {
                  const entryDate = new Date(date)
                  entryDate.setHours(0, 0, 0, 0)
                  const entry = await prisma.foodEntry.create({
                    data: {
                      userId,
                      userFoodId: parsedArgs.userFoodId,
                      grams: Number(parsedArgs.grams),
                      date: entryDate
                    },
                    include: { userFood: true }
                  })
                  const calories = Math.round((food.caloriesPer100g * parsedArgs.grams) / 100)
                  const message = `Added ${parsedArgs.grams}g of ${food.name} (${calories} kcal) to your log.`
                  toolResult = await formatFoodOperationResult(message)
                  result.foodAdded = entry
                }
                break
              }
              case 'edit_food_entry': {
                const entry = await prisma.foodEntry.findFirst({
                  where: { id: parsedArgs.id, userId },
                  include: { userFood: true }
                })
                if (!entry) {
                  toolResult = `Error: Food entry not found.`
                } else {
                  // Check if nutritional info updates are provided
                  const nutritionUpdates: any = {}
                  if (parsedArgs.caloriesPer100g !== undefined) nutritionUpdates.caloriesPer100g = Number(parsedArgs.caloriesPer100g)
                  if (parsedArgs.proteinPer100g !== undefined) nutritionUpdates.proteinPer100g = Number(parsedArgs.proteinPer100g)
                  if (parsedArgs.carbsPer100g !== undefined) nutritionUpdates.carbsPer100g = Number(parsedArgs.carbsPer100g)
                  if (parsedArgs.fatPer100g !== undefined) nutritionUpdates.fatPer100g = Number(parsedArgs.fatPer100g)
                  if (parsedArgs.fiberPer100g !== undefined) nutritionUpdates.fiberPer100g = Number(parsedArgs.fiberPer100g)
                  if (parsedArgs.saltPer100g !== undefined) nutritionUpdates.saltPer100g = Number(parsedArgs.saltPer100g)

                  const hasNutritionUpdates = Object.keys(nutritionUpdates).length > 0
                  const hasGramsUpdate = parsedArgs.grams !== undefined

                  // Update underlying food's nutritional info if any provided
                  if (hasNutritionUpdates) {
                    await prisma.userFood.update({
                      where: { id: entry.userFoodId },
                      data: nutritionUpdates
                    })
                  }

                  // Update entry grams if provided
                  let updated = entry
                  if (hasGramsUpdate) {
                    updated = await prisma.foodEntry.update({
                      where: { id: parsedArgs.id },
                      data: { grams: Number(parsedArgs.grams) },
                      include: { userFood: true }
                    })
                  } else if (hasNutritionUpdates) {
                    // Refetch to get updated userFood
                    updated = await prisma.foodEntry.findFirst({
                      where: { id: parsedArgs.id },
                      include: { userFood: true }
                    }) || entry
                  }

                  // Build clean message
                  const foodName = entry.userFood.name
                  let message: string
                  if (hasNutritionUpdates && hasGramsUpdate) {
                    message = `Updated "${foodName}" (nutrition, ${entry.grams}g → ${parsedArgs.grams}g).`
                  } else if (hasNutritionUpdates) {
                    message = `Updated "${foodName}" nutrition info.`
                  } else if (hasGramsUpdate) {
                    message = `Updated "${foodName}" (${entry.grams}g → ${parsedArgs.grams}g).`
                  } else {
                    message = `No changes made to "${foodName}".`
                  }
                  toolResult = await formatFoodOperationResult(message)
                  result.foodUpdated = updated
                }
                break
              }
              case 'delete_food_entry': {
                const entry = await prisma.foodEntry.findFirst({
                  where: { id: parsedArgs.id, userId },
                  include: { userFood: true }
                })
                if (!entry) {
                  toolResult = `Error: Food entry not found.`
                } else {
                  await prisma.foodEntry.delete({ where: { id: parsedArgs.id } })
                  const message = `Deleted ${entry.userFood.name} (${entry.grams}g) from your log.`
                  toolResult = await formatFoodOperationResult(message)
                  result.foodDeleted = parsedArgs.id
                }
                break
              }
              case 'web_search': {
                const results = await webSearch(parsedArgs.query)
                toolResult = `Search results for "${parsedArgs.query}":\n\n${results}`
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
          if (result.foodAdded || result.foodUpdated || result.foodDeleted || result.userFoodCreated) {
            await createChatEvent(chatSessionId, 'data_changed', { type: 'data_changed', data: result, targetDate: dateStr })
          }

          toolMessages.push({ role: 'tool', content: toolResult, tool_call_id: toolCallId })
        }

        // Add tool results to conversation and request next round
        builtMessages.push(...toolMessages)
        const followupPayload = { model, messages: builtMessages, tools, temperature: 0.3, reasoning: { effort: 'minimal' } }

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
        const followData = await follow.json()
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
