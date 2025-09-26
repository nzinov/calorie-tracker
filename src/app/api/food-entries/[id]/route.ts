import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, quantity, portionSizeGrams, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g, saltPer100g } = body

    // Verify the food entry belongs to the user
    const existingEntry = await db.foodEntry.findFirst({
      where: {
        id: id,
        dailyLog: {
          userId: userId,
        },
      },
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Food entry not found" },
        { status: 404 }
      )
    }

    // Update the food entry
    const updatedEntry = await db.foodEntry.update({
      where: { id: id },
      data: {
        name: name || existingEntry.name,
        quantity: quantity || existingEntry.quantity,
        portionSizeGrams: portionSizeGrams !== undefined ? parseFloat(portionSizeGrams) : existingEntry.portionSizeGrams,
        caloriesPer100g: caloriesPer100g !== undefined ? parseFloat(caloriesPer100g) : existingEntry.caloriesPer100g,
        proteinPer100g: proteinPer100g !== undefined ? parseFloat(proteinPer100g) : existingEntry.proteinPer100g,
        carbsPer100g: carbsPer100g !== undefined ? parseFloat(carbsPer100g) : existingEntry.carbsPer100g,
        fatPer100g: fatPer100g !== undefined ? parseFloat(fatPer100g) : existingEntry.fatPer100g,
        fiberPer100g: fiberPer100g !== undefined ? parseFloat(fiberPer100g) : existingEntry.fiberPer100g,
        saltPer100g: saltPer100g !== undefined ? parseFloat(saltPer100g) : existingEntry.saltPer100g,
      },
    })

    return NextResponse.json(updatedEntry)
  } catch (error) {
    console.error("Error updating food entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify the food entry belongs to the user
    const existingEntry = await db.foodEntry.findFirst({
      where: {
        id: id,
        dailyLog: {
          userId: userId,
        },
      },
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Food entry not found" },
        { status: 404 }
      )
    }

    // Delete the food entry
    await db.foodEntry.delete({
      where: { id: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting food entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
