import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getNutritionCacheItems, deleteNutritionCacheItem } from "@/lib/food"

function getUserIdFromSession(session: any) {
  return process.env.NODE_ENV === 'development' ? 'dev-user' : session?.user?.id
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions as any)
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure dev user exists in development mode
    if (process.env.NODE_ENV === 'development') {
      const existingUser = await db.user.findUnique({ where: { id: 'dev-user' } })
      if (!existingUser) {
        await db.user.create({
          data: { id: 'dev-user', email: 'dev@example.com', name: 'Dev User' }
        })
      }
    }

    const items = await getNutritionCacheItems(userId, 100)
    
    return NextResponse.json({ items })
  } catch (error) {
    console.error("Error fetching nutrition cache items:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any)
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: "ID parameter is required" }, { status: 400 })
    }

    await deleteNutritionCacheItem(userId, id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting nutrition cache item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}