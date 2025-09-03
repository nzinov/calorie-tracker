import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
    const { messageId } = await params

    // Fetch the message and verify it belongs to the user (through chat session -> daily log)
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        chatSession: {
          dailyLog: {
            userId
          }
        }
      },
      select: {
        id: true,
        role: true,
        content: true,
        timestamp: true,
        toolCalls: true,
        toolCallId: true
      }
    })

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      )
    }

    // Only return debug data for assistant messages
    if (message.role !== 'assistant') {
      return NextResponse.json(
        { error: "Debug data only available for assistant messages" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      messageId: message.id,
      debugData: {
        toolCalls: message.toolCalls,
        toolCallId: message.toolCallId
      },
      metadata: {
        timestamp: message.timestamp,
        content: message.content,
        role: message.role
      }
    })
  } catch (error) {
    console.error("Error fetching message debug data:", error)
    return NextResponse.json(
      { error: "Failed to fetch debug data" },
      { status: 500 }
    )
  }
}