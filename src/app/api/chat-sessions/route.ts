import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

    // Ensure dev user exists in development mode
    if (process.env.NODE_ENV === 'development') {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: 'dev@localhost' }
      })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const date = dateParam ? new Date(dateParam) : new Date()

    // Set to start of day
    date.setHours(0, 0, 0, 0)

    // Get chat sessions for this user and date
    const chatSessions = await prisma.chatSession.findMany({
      where: { userId, date },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            timestamp: true,
            toolCalls: true,
            toolCallId: true
          }
        }
      }
    })

    return NextResponse.json(chatSessions)
  } catch (error) {
    console.error("Error fetching chat sessions:", error)
    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

    // Ensure dev user exists in development mode
    if (process.env.NODE_ENV === 'development') {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: 'dev@localhost' }
      })
    }

    const { date: dateParam } = await request.json()
    const date = dateParam ? new Date(dateParam) : new Date()

    // Set to start of day
    date.setHours(0, 0, 0, 0)

    // Create or fetch chat session - handle race condition where concurrent
    // requests may both try to create the same session
    let chatSession
    try {
      chatSession = await prisma.chatSession.upsert({
        where: { userId_date: { userId, date } },
        update: {},
        create: {
          userId,
          date,
          messages: {
            create: {
              role: "assistant",
              content: "Hi! I'm here to help you track your nutrition. Tell me what you ate and I'll log it for you!"
            }
          }
        },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              timestamp: true,
              toolCalls: true,
              toolCallId: true
            }
          }
        }
      })
    } catch (error) {
      // P2002 = unique constraint violation - another request created the session first
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        chatSession = await prisma.chatSession.findUnique({
          where: { userId_date: { userId, date } },
          include: {
            messages: {
              orderBy: { timestamp: 'asc' },
              select: {
                id: true,
                role: true,
                content: true,
                timestamp: true,
                toolCalls: true,
                toolCallId: true
              }
            }
          }
        })
      } else {
        throw error
      }
    }

    return NextResponse.json(chatSession)
  } catch (error) {
    console.error("Error creating chat session:", error)
    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    )
  }
}
