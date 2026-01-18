import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

// Helper function to calculate nutrition totals from food entries
function calculateTotals(entries: Array<{ grams: number; userFood: { caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; fiberPer100g: number; saltPer100g: number } }>) {
  return entries.reduce(
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
      await db.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: 'dev@localhost' }
      })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")

    if (!dateParam) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }

    // Parse date to start and end of day for querying
    const startDate = new Date(dateParam)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(dateParam)
    endDate.setHours(23, 59, 59, 999)

    // Get food entries for this date with userFood info included
    const foodEntries = await db.foodEntry.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        userFood: true
      },
      orderBy: { timestamp: "asc" }
    })

    // Calculate totals
    const totals = calculateTotals(foodEntries)

    return NextResponse.json({
      date: startDate.toISOString(),
      foodEntries,
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
