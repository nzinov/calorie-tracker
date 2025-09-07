import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { addFoodEntry } from "@/lib/food"
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
    const { name, quantity, calories, protein, carbs, fat, fiber, salt, date } = body

    // Validate required fields
    if (!name || !quantity || calories === undefined || protein === undefined || 
        carbs === undefined || fat === undefined || fiber === undefined || salt === undefined || !date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Use the library function
    const foodEntry = await addFoodEntry(userId, {
      name,
      quantity,
      calories: parseFloat(calories),
      protein: parseFloat(protein),
      carbs: parseFloat(carbs),
      fat: parseFloat(fat),
      fiber: parseFloat(fiber),
      salt: parseFloat(salt),
      date,
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
