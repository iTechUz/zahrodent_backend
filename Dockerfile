# # ==================== BASE STAGE ====================
# FROM oven/bun:1-slim AS base

# WORKDIR /app

# # Install system dependencies (OpenSSL required for Prisma)
# RUN apt-get update -y && \
#     apt-get install -y \
#     openssl \
#     ca-certificates \
#     curl \
#     && rm -rf /var/lib/apt/lists/*

# # ==================== DEPENDENCIES STAGE ====================
# FROM base AS deps

# WORKDIR /app

# # Copy package files
# COPY bun.lockb* package.json tsconfig.json ./

# # Install ALL dependencies (Bun is 25x faster than npm/yarn!)
# RUN bun install --frozen-lockfile && bun add tsconfig-paths

# # ==================== BUILDER STAGE ====================
# FROM base AS builder

# WORKDIR /app

# # Copy installed dependencies
# COPY --from=deps /app/node_modules ./node_modules

# # Copy application source code
# COPY . .

# # Generate Prisma Client (Bun compatible)
# RUN bun run prisma:gen
# RUN bunx tsc


# # Build NestJS application with Bun
# RUN bun run build

# # Prune dev dependencies (keep only production)
# RUN bun install --production --frozen-lockfile

# # ==================== RUNNER STAGE ====================
# FROM oven/bun:1-slim AS runner

# WORKDIR /app

# # Install runtime dependencies
# RUN apt-get update -y && \
#     apt-get install -y \
#     openssl \
#     ca-certificates \
#     && rm -rf /var/lib/apt/lists/*

# # Create non-root user for security
# RUN groupadd -r bunuser && \
#     useradd -r -g bunuser -s /bin/false bunuser && \
#     chown -R bunuser:bunuser /app

# # Copy built application from builder
# COPY --from=builder --chown=bunuser:bunuser /app/dist ./dist
# COPY --from=builder --chown=bunuser:bunuser /app/node_modules ./node_modules
# COPY --from=builder --chown=bunuser:bunuser /app/prisma ./prisma
# COPY --from=builder --chown=bunuser:bunuser /app/package.json ./

# COPY --from=builder /app/tsconfig.json ./tsconfig.json
# COPY --from=builder /app/tsconfig.build.json ./tsconfig.build.json

# # Switch to non-root user
# USER bunuser

# # Set environment variables
# ENV NODE_ENV=production
# ENV TZ=Asia/Tashkent

# # Expose application port
# EXPOSE 8088

# # Health check
# HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
#   CMD curl -f http://localhost:8088/health || exit 1

# # Start application with Bun runtime
# # CMD ["bun", "run", "dist/src/main.js"]
# # CMD ["node", "-r", "tsconfig-paths/register", "dist/src/main.js"]

# CMD ["node", "-r", "tsconfig-paths/register", "dist/src/main.js"]

# ==================== BASE STAGE ====================
FROM oven/bun:1-slim AS base

WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ==================== DEPS STAGE ====================
FROM base AS deps

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# ==================== BUILDER STAGE ====================
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN bun run prisma:gen

# Build application
RUN bun run build

# ==================== PRODUCTION STAGE ====================
FROM base AS runner

WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r bunuser && \
    useradd -r -g bunuser -s /bin/false bunuser && \
    chown -R bunuser:bunuser /app

# Copy only necessary files
COPY --from=builder --chown=bunuser:bunuser /app/dist ./dist
COPY --from=builder --chown=bunuser:bunuser /app/node_modules ./node_modules
COPY --from=builder --chown=bunuser:bunuser /app/prisma ./prisma
COPY --from=builder --chown=bunuser:bunuser /app/package.json ./
COPY --from=builder --chown=bunuser:bunuser /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=bunuser:bunuser /app/tsconfig.build.json ./tsconfig.build.json

USER bunuser

ENV NODE_ENV=production
ENV TZ=Asia/Tashkent
ENV TS_NODE_BASEURL=./dist

EXPOSE 8088

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8088/health || exit 1

# Run with Node + tsconfig-paths so `src/*` aliases resolve in dist.
CMD ["node", "-r", "tsconfig-paths/register", "dist/src/main.js"]