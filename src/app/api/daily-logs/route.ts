import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

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
