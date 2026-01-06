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
      await db.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: 'dev@localhost' }
      })
    }

    const body = await request.json()
    const { userFoodId, grams, date } = body

    // Validate required fields
    if (!userFoodId || grams === undefined || !date) {
      return NextResponse.json(
        { error: "Missing required fields: userFoodId, grams, date" },
        { status: 400 }
      )
    }

    // Verify the userFood belongs to this user
    const userFood = await db.userFood.findFirst({
      where: { id: userFoodId, userId }
    })

    if (!userFood) {
      return NextResponse.json(
        { error: "Food not found in your database" },
        { status: 404 }
      )
    }

    // Parse date to start of day
    const entryDate = new Date(date)
    entryDate.setHours(0, 0, 0, 0)

    // Create the food entry
    const foodEntry = await db.foodEntry.create({
      data: {
        userId,
        userFoodId,
        grams: Number(grams),
        date: entryDate
      },
      include: {
        userFood: true
      }
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
