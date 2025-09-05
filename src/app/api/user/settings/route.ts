import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { DAILY_TARGETS } from "@/lib/constants"

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

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const targets = {
      calories: user.targetCalories ?? DAILY_TARGETS.calories,
      protein: user.targetProtein ?? DAILY_TARGETS.protein,
      carbs: user.targetCarbs ?? DAILY_TARGETS.carbs,
      fat: user.targetFat ?? DAILY_TARGETS.fat,
      fiber: user.targetFiber ?? DAILY_TARGETS.fiber,
      salt: user.targetSalt ?? DAILY_TARGETS.salt,
    }

    return NextResponse.json({ targets })
  } catch (error) {
    console.error("Error fetching user settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any)
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      calories,
      protein,
      carbs,
      fat,
      fiber,
      salt,
    } = body || {}

    const updateData: any = {}
    if (typeof calories === 'number') updateData.targetCalories = calories
    if (typeof protein === 'number') updateData.targetProtein = protein
    if (typeof carbs === 'number') updateData.targetCarbs = carbs
    if (typeof fat === 'number') updateData.targetFat = fat
    if (typeof fiber === 'number') updateData.targetFiber = fiber
    if (typeof salt === 'number') updateData.targetSalt = salt

    await db.user.update({ where: { id: userId }, data: updateData })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
