import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

// GET /api/user-foods - List all user foods (with optional search)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const userFoods = await db.userFood.findMany({
      where: {
        userId,
        ...(search ? {
          name: {
            contains: search,
          }
        } : {})
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({ items: userFoods })
  } catch (error) {
    console.error('Error fetching user foods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/user-foods - Create a new food in user's database
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g, saltPer100g, defaultGrams, comments } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Ensure user exists (for dev mode)
    if (process.env.NODE_ENV === 'development') {
      await db.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: 'dev@localhost' }
      })
    }

    const userFood = await db.userFood.create({
      data: {
        userId,
        name,
        caloriesPer100g: Number(caloriesPer100g) || 0,
        proteinPer100g: Number(proteinPer100g) || 0,
        carbsPer100g: Number(carbsPer100g) || 0,
        fatPer100g: Number(fatPer100g) || 0,
        fiberPer100g: Number(fiberPer100g) || 0,
        saltPer100g: Number(saltPer100g) || 0,
        defaultGrams: defaultGrams ? Number(defaultGrams) : null,
        comments: comments || null
      }
    })

    return NextResponse.json(userFood, { status: 201 })
  } catch (error: any) {
    console.error('Error creating user food:', error)

    // Handle unique constraint violation
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A food with this name already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
