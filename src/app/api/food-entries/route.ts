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
    const { name, quantity, portionSizeGrams, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g, saltPer100g, date } = body

    // Validate required fields
    if (!name || !quantity || portionSizeGrams === undefined || caloriesPer100g === undefined || 
        proteinPer100g === undefined || carbsPer100g === undefined || fatPer100g === undefined || 
        fiberPer100g === undefined || saltPer100g === undefined || !date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Use the library function
    const foodEntry = await addFoodEntry(userId, {
      name,
      quantity,
      portionSizeGrams: parseFloat(portionSizeGrams),
      caloriesPer100g: parseFloat(caloriesPer100g),
      proteinPer100g: parseFloat(proteinPer100g),
      carbsPer100g: parseFloat(carbsPer100g),
      fatPer100g: parseFloat(fatPer100g),
      fiberPer100g: parseFloat(fiberPer100g),
      saltPer100g: parseFloat(saltPer100g),
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
