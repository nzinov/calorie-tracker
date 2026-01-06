import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

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

    // Verify the chat session belongs to the user
    const chatSession = await db.chatSession.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!chatSession) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 })
    }

    // Delete all messages for this chat session
    await db.chatMessage.deleteMany({
      where: {
        chatSessionId: id
      }
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error clearing chat messages:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}