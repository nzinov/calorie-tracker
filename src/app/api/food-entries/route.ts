import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createChatEvent } from "@/lib/events"

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
    const { userFoodId, grams, date, chatSessionId } = body

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

    // If chatSessionId provided, emit a pill message to the chat
    if (chatSessionId) {
      const calories = Math.round((userFood.caloriesPer100g * Number(grams)) / 100)
      const content = `[User manually added ${grams}g of ${userFood.name} (${calories} kcal) via quick-add]`

      // Save to ChatMessage table so model sees it in history (as user message since tool requires tool_call)
      const savedMessage = await db.chatMessage.create({
        data: {
          role: 'user',
          content,
          chatSessionId,
          toolCalls: null,
          toolCallId: null,
        }
      })

      // Emit event for real-time UI update (still show as tool pill in UI)
      const eventPayload = {
        type: 'message',
        message: {
          id: savedMessage.id,
          role: 'tool',
          content: `Added ${grams}g of ${userFood.name} (${calories} kcal)`,
        }
      }
      await createChatEvent(chatSessionId, 'message', eventPayload)
    }

    return NextResponse.json(foodEntry, { status: 201 })
  } catch (error) {
    console.error("Error creating food entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
