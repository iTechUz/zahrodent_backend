# ─────────────────────────────────────────────
#  Stage 1 — Dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl python3 make g++

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

# ─────────────────────────────────────────────
#  Stage 2 — Builder
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client generate
RUN npx prisma generate

# TypeScript build
RUN npm run build

# ─────────────────────────────────────────────
#  Stage 3 — Runner (production)
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl curl python3 make g++

# Security: alohida user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Faqat kerakli fayllarni ko'chirish
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/package.json  ./

# Entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER appuser

ENV NODE_ENV=production
ENV TZ=Asia/Tashkent

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
