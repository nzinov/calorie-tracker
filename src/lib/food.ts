import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { db } from "./db"


export async function ensureDailyLog(userId: string, date: Date) {
  return db.dailyLog.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { userId, date },
  })
}

export async function addFoodEntry(userId: string, args: {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
  date: string | Date
}) {
  const date = new Date(args.date)
  date.setHours(0, 0, 0, 0)
  const dailyLog = await ensureDailyLog(userId, date)
  return db.foodEntry.create({
    data: {
      name: args.name,
      quantity: args.quantity,
      calories: Number(args.calories),
      protein: Number(args.protein),
      carbs: Number(args.carbs),
      fat: Number(args.fat),
      fiber: Number(args.fiber),
      salt: Number(args.salt),
      dailyLogId: dailyLog.id,
    },
  })
}

export async function editFoodEntry(userId: string, id: string, args: Partial<{
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
}>) {
  // Verify the entry belongs to user's daily log
  const entry = await db.foodEntry.findFirst({
    where: {
      id,
      dailyLog: { userId }
    }
  })
  
  if (!entry) {
    throw new Error('Food entry not found or access denied')
  }

  return db.foodEntry.update({
    where: { id },
    data: {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.quantity !== undefined ? { quantity: args.quantity } : {}),
      ...(args.calories !== undefined ? { calories: Number(args.calories) } : {}),
      ...(args.protein !== undefined ? { protein: Number(args.protein) } : {}),
      ...(args.carbs !== undefined ? { carbs: Number(args.carbs) } : {}),
      ...(args.fat !== undefined ? { fat: Number(args.fat) } : {}),
      ...(args.fiber !== undefined ? { fiber: Number(args.fiber) } : {}),
      ...(args.salt !== undefined ? { salt: Number(args.salt) } : {}),
    },
  })
}

export async function deleteFoodEntry(userId: string, id: string) {
  // Verify the entry belongs to user's daily log
  const entry = await db.foodEntry.findFirst({
    where: {
      id,
      dailyLog: { userId }
    }
  })
  
  if (!entry) {
    throw new Error('Food entry not found or access denied')
  }

  await db.foodEntry.delete({ where: { id } })
  return { ok: true }
}

export async function getCurrentNutritionalData(userId: string, date: Date) {
  // Create a new Date object to avoid mutating the input
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)
  
  const dailyLog = await db.dailyLog.upsert({
    where: { userId_date: { userId, date: targetDate } },
    update: {},
    create: { userId, date: targetDate },
    include: {
      foodEntries: {
        orderBy: { timestamp: "asc" },
      },
    },
  })

  // Calculate totals
  const totals = dailyLog.foodEntries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
      fiber: acc.fiber + entry.fiber,
      salt: acc.salt + entry.salt,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 }
  )

  console.log('getCurrentNutritionalData', userId, date, totals)
  return {
    dailyLog,
    totals,
    foodEntries: dailyLog.foodEntries
  }
}

export async function lookupNutritionalInfo(foodDescription: string): Promise<{
  name: string
  portionDescription: string
  portionSizeGrams: number
  per100g: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    salt: number
  }
}> {
  // Get OpenRouter API key (reuse the same function from the chat routes)
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
    } catch {
      throw new Error('OPENROUTER_API_KEY not found in environment or ~/.openrouter.token file')
    }
  }

  const prompt = `I need nutritional information for: "${foodDescription}"

Use integrated web search to find authoritative nutrition sources (e.g., USDA, brand labels, manufacturer pages) before answering. Return data for this food item in EXACTLY the following JSON shape. Important: provide macros per 100g, not per portion, and include the usual portion description and its size in grams.

{
  "name": "descriptive name of the food",
  "portionDescription": "usual portion description (e.g., '1 medium apple')",
  "portionSizeGrams": 150,
  "per100g": {
    "calories": 52,
    "protein": 0.3,
    "carbs": 13.8,
    "fat": 0.2,
    "fiber": 2.4,
    "salt": 0.0
  }
}

Rules:
- Use metric units only.
- If salt data is unavailable, estimate 0 for whole foods or a typical value for processed foods.
- Do NOT include any commentary before or after the JSON.`

  try {
    const MODEL = process.env.OPENROUTER_LOOKUP_MODEL || 'openai/gpt-5'
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getOpenRouterApiKey()}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Calorie Tracker App'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        temperature: 0.2,
        // Enable reasoning/thinking and integrated web search (provider-handled)
        reasoning: { effort: 'low' },
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'nutrition_lookup_result',
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'portionDescription', 'portionSizeGrams', 'per100g'],
              properties: {
                name: { type: 'string', minLength: 1 },
                portionDescription: { type: 'string', minLength: 1 },
                portionSizeGrams: { type: 'number' },
                per100g: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['calories', 'protein', 'carbs', 'fat', 'fiber', 'salt'],
                  properties: {
                    calories: { type: 'number' },
                    protein: { type: 'number' },
                    carbs: { type: 'number' },
                    fat: { type: 'number' },
                    fiber: { type: 'number' },
                    salt: { type: 'number' }
                  }
                }
              }
            },
            strict: true
          }
        },
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    // Verbose logging of provider response (status + headers)
    try {
      console.log('[lookup] OpenRouter status:', response.status, response.statusText)
      const hdrs: Record<string, string> = {}
      response.headers.forEach((v, k) => { hdrs[k] = v })
      console.log('[lookup] OpenRouter headers:', JSON.stringify(hdrs, null, 2))
    } catch {}

    if (!response.ok) {
      let errBody: any = null
      try { errBody = await response.json() } catch { try { errBody = await response.text() } catch {} }
      try { console.error('[lookup] OpenRouter error body:', typeof errBody === 'string' ? errBody : JSON.stringify(errBody, null, 2)) } catch {}
      throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errBody)}`)
    }

    const data = await response.json()
    try { console.log('[lookup] OpenRouter response body:', JSON.stringify(data, null, 2)) } catch {}
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenRouter API')
    }

    if (typeof content !== 'string') {
      throw new Error('Expected JSON string content from model')
    }

    const parsed: any = JSON.parse(content)

    // Validate the response has required fields
    const requiredTop = ['name', 'portionDescription', 'portionSizeGrams', 'per100g']
    for (const field of requiredTop) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
    const requiredPer100 = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'salt']
    for (const field of requiredPer100) {
      if (!(field in parsed.per100g)) {
        // Default salt to 0 if missing; otherwise require the field
        if (field === 'salt') { parsed.per100g.salt = 0 } else {
          throw new Error(`Missing required field in per100g: ${field}`)
        }
      }
    }

    // Ensure numeric fields are numbers
    const toNum = (v: any) => {
      if (typeof v === 'number') return v
      if (typeof v === 'string') {
        const n = parseFloat(v.replace(/[^0-9.+-eE]/g, ''))
        if (!isFinite(n)) throw new Error(`Invalid number: ${v}`)
        return n
      }
      throw new Error(`Expected number or numeric string, got ${typeof v}`)
    }
    parsed.portionSizeGrams = toNum(parsed.portionSizeGrams)
    parsed.per100g.calories = toNum(parsed.per100g.calories)
    parsed.per100g.protein = toNum(parsed.per100g.protein)
    parsed.per100g.carbs = toNum(parsed.per100g.carbs)
    parsed.per100g.fat = toNum(parsed.per100g.fat)
    parsed.per100g.fiber = toNum(parsed.per100g.fiber)
    parsed.per100g.salt = toNum(parsed.per100g.salt)

    return parsed
  } catch (error) {
    console.error('Error in nutritional lookup:', error)
    throw new Error(`Failed to lookup nutritional information: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function canonicalNutritionKey(input: string): string {
  return (input || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function saveNutritionCacheItem(userId: string, keyRaw: string, info: {
  name: string
  portionDescription: string
  portionSizeGrams: number
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number; salt: number }
}) {
  const key = canonicalNutritionKey(keyRaw)
  try {
    const rec = await db.nutritionCacheItem.upsert({
      where: { userId_key: { userId, key } },
      update: {
        name: info.name,
        portionDescription: info.portionDescription,
        portionSizeGrams: Number(info.portionSizeGrams),
        caloriesPer100g: Number(info.per100g.calories),
        proteinPer100g: Number(info.per100g.protein),
        carbsPer100g: Number(info.per100g.carbs),
        fatPer100g: Number(info.per100g.fat),
        fiberPer100g: Number(info.per100g.fiber),
        saltPer100g: Number(info.per100g.salt),
        rawJson: JSON.stringify(info)
      },
      create: {
        userId,
        key,
        name: info.name,
        portionDescription: info.portionDescription,
        portionSizeGrams: Number(info.portionSizeGrams),
        caloriesPer100g: Number(info.per100g.calories),
        proteinPer100g: Number(info.per100g.protein),
        carbsPer100g: Number(info.per100g.carbs),
        fatPer100g: Number(info.per100g.fat),
        fiberPer100g: Number(info.per100g.fiber),
        saltPer100g: Number(info.per100g.salt),
        rawJson: JSON.stringify(info)
      }
    })
    return rec
  } catch (e) {
    console.error('Failed to save nutrition cache item', e)
    return null
  }
}

export async function getNutritionCacheItems(userId: string, limit = 20) {
  try {
    const rows = await db.nutritionCacheItem.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit
    })
    return rows
  } catch (e) {
    console.error('Failed to load nutrition cache items', e)
    return []
  }
}

export async function deleteNutritionCacheItem(userId: string, id: string) {
  // Verify the item belongs to the user
  const item = await db.nutritionCacheItem.findFirst({
    where: {
      id,
      userId
    }
  })
  
  if (!item) {
    throw new Error('Nutrition cache item not found or access denied')
  }

  await db.nutritionCacheItem.delete({ where: { id } })
  return { ok: true }
}
