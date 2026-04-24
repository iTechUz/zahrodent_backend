# ==================== BUILD STAGE ====================
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies (OpenSSL required for Prisma)
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

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
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup && \
    chown -R nodeuser:nodegroup /app

# Copy production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files and Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set production environment
ENV NODE_ENV=production
ENV TZ=Asia/Tashkent

# Expose port
EXPOSE 7878

USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:7878/health || exit 1

# Bazani schema.prisma bilan avtomatik sinxronlash va serverni ishga tushirish
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run start:prod"]
