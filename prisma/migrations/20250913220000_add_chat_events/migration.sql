-- CreateTable
CREATE TABLE "chat_events" (
    "id" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_events_chatSessionId_createdAt_idx" ON "chat_events"("chatSessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

