# ==================== BUILD STAGE ====================
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies (OpenSSL required for Prisma)
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Reproducible install from the lockfile
RUN npm ci --no-audit --no-fund

# Copy Prisma schema first for caching
COPY prisma ./prisma/

# Generate Prisma Client
RUN npm run prisma:generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ==================== PRODUCTION STAGE ====================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache openssl curl

# Create non-root user
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup

# Production dependencies only. `prisma` (CLI) is a regular dependency pinned
# to the @prisma/client version, so `migrate deploy` below never downloads
# a different (incompatible) Prisma at container start.
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Copy built files and Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Files stay root-owned (read-only for the app user); nothing is written at runtime.
# Set production environment
ENV NODE_ENV=production
ENV TZ=Asia/Tashkent
ENV PORT=7878

# Expose port
EXPOSE 7878

USER nodeuser

# Health check (GET /health — no DB access, no auth)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT:-7878}/health" || exit 1

# Apply pending migrations, then start. `exec` makes node PID 1 so SIGTERM
# triggers Nest shutdown hooks (Prisma disconnect, Telegram bot stop).
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/src/main.js"]
