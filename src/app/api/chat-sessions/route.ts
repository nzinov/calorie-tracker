import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id

    // Ensure dev user exists in development mode
    if (process.env.NODE_ENV === 'development') {
      const existingUser = await prisma.user.findUnique({
        where: { id: 'dev-user' }
      })
      
      if (!existingUser) {
        await prisma.user.create({
          data: {
            id: 'dev-user',
            email: 'dev@example.com',
            name: 'Dev User'
          }
        })
      }
    }
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const date = dateParam ? new Date(dateParam) : new Date()
    
    // Set to start of day
    date.setHours(0, 0, 0, 0)

    // Create or fetch daily log atomically to avoid unique violations
    const dailyLog = await prisma.dailyLog.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date },
      include: {
        chatSessions: {
          include: {
            messages: { orderBy: { timestamp: 'asc' } }
          }
        }
      }
    })

    return NextResponse.json(dailyLog.chatSessions)
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
      const existingUser = await prisma.user.findUnique({
        where: { id: 'dev-user' }
      })
      
      if (!existingUser) {
        await prisma.user.create({
          data: {
            id: 'dev-user',
            email: 'dev@example.com',
            name: 'Dev User'
          }
        })
      }
    }
    const { date: dateParam } = await request.json()
    const date = dateParam ? new Date(dateParam) : new Date()
    
    // Set to start of day
    date.setHours(0, 0, 0, 0)

    // Create or fetch daily log atomically to avoid unique violations
    const dailyLog = await prisma.dailyLog.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date }
    })

    // Create or fetch chat session atomically to avoid unique violations
    const chatSession = await prisma.chatSession.upsert({
      where: { dailyLogId: dailyLog.id },
      update: {},
      create: {
        dailyLogId: dailyLog.id,
        messages: {
          create: {
            role: "assistant",
            content: "Hi! I'm here to help you track your nutrition. Tell me what you ate and I'll log it for you!"
          }
        }
      },
      include: {
        messages: { orderBy: { timestamp: 'asc' } }
      }
    })

    return NextResponse.json(chatSession)
  } catch (error) {
    console.error("Error creating chat session:", error)
    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    )
  }
}
