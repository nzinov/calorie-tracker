-- PostgreSQL initial migration matching current Prisma schema

-- Users
CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "emailVerified" TIMESTAMP(3),
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");

-- Accounts (NextAuth)
CREATE TABLE "accounts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts" ("provider", "providerAccountId");

-- Sessions (NextAuth)
CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions" ("sessionToken");

-- Verification tokens (NextAuth)
CREATE TABLE "verificationtokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "verificationtokens_token_key" ON "verificationtokens" ("token");
CREATE UNIQUE INDEX "verificationtokens_identifier_token_key" ON "verificationtokens" ("identifier", "token");

-- Daily logs
CREATE TABLE "daily_logs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "daily_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "daily_logs_userId_date_key" ON "daily_logs" ("userId", "date");

-- Food entries
CREATE TABLE "food_entries" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" TEXT NOT NULL,
  "calories" DOUBLE PRECISION NOT NULL,
  "protein" DOUBLE PRECISION NOT NULL,
  "carbs" DOUBLE PRECISION NOT NULL,
  "fat" DOUBLE PRECISION NOT NULL,
  "fiber" DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dailyLogId" TEXT NOT NULL,
  CONSTRAINT "food_entries_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "daily_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Chat sessions
CREATE TABLE "chat_sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "dailyLogId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_sessions_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "daily_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "chat_sessions_dailyLogId_key" ON "chat_sessions" ("dailyLogId");

-- Chat messages
CREATE TABLE "chat_messages" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "chatSessionId" TEXT NOT NULL,
  CONSTRAINT "chat_messages_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "chat_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

