import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { name, quantity, calories, protein, carbs, fat, fiber, date } = body

    // Validate required fields
    if (!name || !quantity || calories === undefined || protein === undefined || 
        carbs === undefined || fat === undefined || fiber === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const targetDate = date ? new Date(date) : new Date()
    targetDate.setHours(0, 0, 0, 0)

    // Find or create daily log
    let dailyLog = await db.dailyLog.findFirst({
      where: {
        userId: userId,
        date: targetDate,
      },
    })

    if (!dailyLog) {
      dailyLog = await db.dailyLog.create({
        data: {
          userId: userId,
          date: targetDate,
        },
      })
    }

    // Create food entry
    const foodEntry = await db.foodEntry.create({
      data: {
        name,
        quantity,
        calories: parseFloat(calories),
        protein: parseFloat(protein),
        carbs: parseFloat(carbs),
        fat: parseFloat(fat),
        fiber: parseFloat(fiber),
        dailyLogId: dailyLog.id,
      },
    })

    return NextResponse.json(foodEntry, { status: 201 })
  } catch (error) {
    console.error("Error creating food entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
