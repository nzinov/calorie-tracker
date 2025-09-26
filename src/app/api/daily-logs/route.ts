import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

// Helper function to calculate per-portion values from per100g data
function calculatePerPortion(entry: any) {
  if (!entry.portionSizeGrams) return entry
  
  const ratio = entry.portionSizeGrams / 100
  return {
    ...entry,
    calories: entry.caloriesPer100g * ratio,
    protein: entry.proteinPer100g * ratio,
    carbs: entry.carbsPer100g * ratio,
    fat: entry.fatPer100g * ratio,
    fiber: entry.fiberPer100g * ratio,
    salt: entry.saltPer100g * ratio
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure dev user exists in development mode
    if (process.env.NODE_ENV === 'development') {
      const existingUser = await db.user.findUnique({
        where: { id: 'dev-user' }
      })
      
      if (!existingUser) {
        await db.user.create({
          data: {
            id: 'dev-user',
            email: 'dev@example.com',
            name: 'Dev User'
          }
        })
      }
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    
    if (!dateParam) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }
    
    const inputDate = new Date(dateParam)
    
    // Create a new Date object to avoid mutating input
    const date = new Date(inputDate)
    date.setHours(0, 0, 0, 0)

    const dailyLog = await db.dailyLog.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date },
      include: {
        foodEntries: {
          orderBy: { timestamp: "asc" },
        },
      },
    })

    // Calculate totals by converting per100g to per-portion values
    const totals = dailyLog.foodEntries.reduce(
      (acc, entry) => {
        const perPortion = calculatePerPortion(entry)
        return {
          calories: acc.calories + perPortion.calories,
          protein: acc.protein + perPortion.protein,
          carbs: acc.carbs + perPortion.carbs,
          fat: acc.fat + perPortion.fat,
          fiber: acc.fiber + perPortion.fiber,
          salt: acc.salt + perPortion.salt,
        }
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 }
    )
    console.log('dailyLog', date, userId, totals)

    return NextResponse.json({
      dailyLog,
      totals,
    })
  } catch (error) {
    console.error("Error fetching daily log:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
