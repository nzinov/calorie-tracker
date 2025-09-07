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
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
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

Please give nutritional data for this food item in this exact JSON format:

{
  "name": "descriptive name of the food",
  "quantity": "estimated serving size (e.g., '2 slices', '1 cup', '150g'), prefer metric units",
  "calories": 250,
  "protein": 12.5,
  "carbs": 30.2,
  "fat": 8.1,
  "fiber": 3.2,
  "salt": 1.1
}`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getOpenRouterApiKey()}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Calorie Tracker App'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      let errBody: any = null
      try { errBody = await response.json() } catch { try { errBody = await response.text() } catch {} }
      throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errBody)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenRouter API')
    }

    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) {
      throw new Error(`Could not extract JSON from response: ${content}`)
    }

    const nutritionalInfo = JSON.parse(jsonMatch[0])

    // Validate the response has required fields
    const required = ['name', 'quantity', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'salt']
    for (const field of required) {
      if (!(field in nutritionalInfo)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // Ensure numeric fields are numbers
    nutritionalInfo.calories = Number(nutritionalInfo.calories)
    nutritionalInfo.protein = Number(nutritionalInfo.protein)
    nutritionalInfo.carbs = Number(nutritionalInfo.carbs)
    nutritionalInfo.fat = Number(nutritionalInfo.fat)
    nutritionalInfo.fiber = Number(nutritionalInfo.fiber)
    nutritionalInfo.salt = Number(nutritionalInfo.salt)

    return nutritionalInfo
  } catch (error) {
    console.error('Error in nutritional lookup:', error)
    throw new Error(`Failed to lookup nutritional information: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
