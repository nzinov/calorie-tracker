import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

// GET /api/user-foods/[id] - Get a single food
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const userFood = await db.userFood.findFirst({
      where: { id, userId }
    })

    if (!userFood) {
      return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    }

    return NextResponse.json(userFood)
  } catch (error) {
    console.error('Error fetching user food:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/user-foods/[id] - Update a food
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify ownership
    const existing = await db.userFood.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    }

    const { name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g, saltPer100g, defaultGrams, comments } = body

    const userFood = await db.userFood.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(caloriesPer100g !== undefined ? { caloriesPer100g: Number(caloriesPer100g) } : {}),
        ...(proteinPer100g !== undefined ? { proteinPer100g: Number(proteinPer100g) } : {}),
        ...(carbsPer100g !== undefined ? { carbsPer100g: Number(carbsPer100g) } : {}),
        ...(fatPer100g !== undefined ? { fatPer100g: Number(fatPer100g) } : {}),
        ...(fiberPer100g !== undefined ? { fiberPer100g: Number(fiberPer100g) } : {}),
        ...(saltPer100g !== undefined ? { saltPer100g: Number(saltPer100g) } : {}),
        ...(defaultGrams !== undefined ? { defaultGrams: defaultGrams ? Number(defaultGrams) : null } : {}),
        ...(comments !== undefined ? { comments: comments || null } : {})
      }
    })

    return NextResponse.json(userFood)
  } catch (error: any) {
    console.error('Error updating user food:', error)

    // Handle unique constraint violation
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A food with this name already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/user-foods/[id] - Delete a food
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const existing = await db.userFood.findFirst({
      where: { id, userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    }

    await db.userFood.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting user food:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
