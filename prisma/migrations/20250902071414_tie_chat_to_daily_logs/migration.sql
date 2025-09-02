/*
  Warnings:

  - You are about to drop the column `userId` on the `chat_sessions` table. All the data in the column will be lost.
  - Added the required column `dailyLogId` to the `chat_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_chat_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyLogId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chat_sessions_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "daily_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_chat_sessions" ("createdAt", "id", "updatedAt") SELECT "createdAt", "id", "updatedAt" FROM "chat_sessions";
DROP TABLE "chat_sessions";
ALTER TABLE "new_chat_sessions" RENAME TO "chat_sessions";
CREATE UNIQUE INDEX "chat_sessions_dailyLogId_key" ON "chat_sessions"("dailyLogId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
