import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (process.env.NODE_ENV !== 'development' && !(session as any)?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role, content, toolCalls, toolCallId } = await request.json()

    if (!role) {
      return NextResponse.json(
        { error: "Role is required" },
        { status: 400 }
      )
    }

    const userId = process.env.NODE_ENV === 'development' ? 'dev-user' : (session as any)?.user?.id
    const { id } = await params

    // Verify the chat session belongs to the user
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!chatSession) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      )
    }

    // Add the new message
    const message = await prisma.chatMessage.create({
      data: {
        role,
        content: content || "",
        chatSessionId: id,
        toolCalls: toolCalls || null,
        toolCallId: toolCallId || null
      }
    })

    // Update the chat session's updatedAt timestamp
    await prisma.chatSession.update({
      where: { id },
      data: { updatedAt: new Date() }
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error("Error adding chat message:", error)
    return NextResponse.json(
      { error: "Failed to add chat message" },
      { status: 500 }
    )
  }
}