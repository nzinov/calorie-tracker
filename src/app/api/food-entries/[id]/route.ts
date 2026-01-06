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
    const { grams, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g, saltPer100g } = body

    // Verify the food entry belongs to the user
    const existingEntry = await db.foodEntry.findFirst({
      where: { id, userId },
      include: { userFood: true }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Food entry not found" },
        { status: 404 }
      )
    }

    // Update underlying food's nutritional info if provided
    const nutritionUpdates: any = {}
    if (caloriesPer100g !== undefined) nutritionUpdates.caloriesPer100g = Number(caloriesPer100g)
    if (proteinPer100g !== undefined) nutritionUpdates.proteinPer100g = Number(proteinPer100g)
    if (carbsPer100g !== undefined) nutritionUpdates.carbsPer100g = Number(carbsPer100g)
    if (fatPer100g !== undefined) nutritionUpdates.fatPer100g = Number(fatPer100g)
    if (fiberPer100g !== undefined) nutritionUpdates.fiberPer100g = Number(fiberPer100g)
    if (saltPer100g !== undefined) nutritionUpdates.saltPer100g = Number(saltPer100g)

    if (Object.keys(nutritionUpdates).length > 0) {
      await db.userFood.update({
        where: { id: existingEntry.userFoodId },
        data: nutritionUpdates
      })
    }

    // Update the food entry grams if provided
    const updatedEntry = await db.foodEntry.update({
      where: { id },
      data: {
        ...(grams !== undefined ? { grams: Number(grams) } : {})
      },
      include: {
        userFood: true
      }
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
      where: { id, userId }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Food entry not found" },
        { status: 404 }
      )
    }

    // Delete the food entry
    await db.foodEntry.delete({
      where: { id }
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
