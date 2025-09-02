import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

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
    const date = dateParam ? new Date(dateParam) : new Date()
    
    // Set to start of day
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

    // Calculate totals
    const totals = dailyLog.foodEntries.reduce(
      (acc, entry) => ({
        calories: acc.calories + entry.calories,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fat: acc.fat + entry.fat,
        fiber: acc.fiber + entry.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    )

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
