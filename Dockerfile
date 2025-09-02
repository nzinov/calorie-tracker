FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Avoid generating Prisma Client during npm ci; we'll control it explicitly
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# Use Postgres Prisma schema during container build
ENV PRISMA_SCHEMA_PATH=/app/prisma/schema.postgres.prisma

# Install dependencies based on the preferred package manager  
COPY package.json package-lock.json* ./
# Copy Prisma schema before npm install to avoid postinstall hook failure
COPY prisma ./prisma
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
ENV PRISMA_SCHEMA_PATH=/app/prisma/schema.postgres.prisma
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client (uses Postgres schema explicitly)
RUN npx prisma generate --schema prisma/schema.postgres.prisma

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder /app/public ./public

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy package.json for runtime dependencies
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.postgres.prisma && node server.js"]
