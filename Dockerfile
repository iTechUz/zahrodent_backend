# ==================== BASE ====================
FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache openssl ca-certificates curl

# ==================== DEPS ====================
FROM base AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# ==================== BUILDER ====================
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma
RUN npx prisma generate

# Build NestJS
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl ca-certificates curl

# Security user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

USER nodeuser

ENV NODE_ENV=production
ENV TZ=Asia/Tashkent

EXPOSE 8088

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8088/health || exit 1

CMD ["node", "dist/src/main.js"]