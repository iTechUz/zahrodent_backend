# Build stages run on Debian (glibc) to match the distroless runtime: Prisma
# engines and native addons (bcrypt) built here must load there.

# ==================== BASE STAGE ====================
FROM node:20-bookworm-slim AS base

# OpenSSL required for Prisma: its version picks which engine npm install
# fetches (openssl-3.0.x, same as distroless). Without it Prisma falls back to
# openssl-1.1.x and the CLI tries to download engines at runtime.
RUN apt-get update -y && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# ==================== LIBSSL STAGE ====================
# Distroless has no package manager, so a Debian security fix reaches it only
# when Google rebuilds the base. Ship the patched libssl3 from the upgraded
# base instead: its files plus the dpkg status entry (what Trivy reads).
FROM base AS libssl

RUN mkdir -p /out/var/lib/dpkg/status.d && \
    dpkg -L libssl3 | while read -r f; do \
      if [ -f "$f" ]; then mkdir -p "/out$(dirname "$f")" && cp -a "$f" "/out$f"; fi; \
    done && \
    dpkg -s libssl3 | grep -v '^Status:' > /out/var/lib/dpkg/status.d/libssl3 && \
    cp /var/lib/dpkg/info/libssl3:*.md5sums /out/var/lib/dpkg/status.d/libssl3.md5sums

# ==================== BUILD STAGE ====================
FROM base AS builder

WORKDIR /app

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

# ==================== PROD DEPS STAGE ====================
FROM base AS prod-deps

WORKDIR /app

# Production dependencies only. `prisma` (CLI) is a regular dependency pinned
# to the @prisma/client version, so CD's `migrate deploy` (run with this image)
# never downloads a different (incompatible) Prisma.
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ==================== PRODUCTION STAGE ====================
# Distroless: no shell, no package manager, no npm — fewer CVEs for Trivy.
# Entrypoint is node, so CMD/`docker run IMAGE <args>` are node arguments.
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner

WORKDIR /app

COPY --from=libssl /out/ /

# Files stay root-owned (read-only for the app user); nothing is written at runtime.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Set production environment
ENV NODE_ENV=development
ENV TZ=Asia/Tashkent
ENV PORT=7879

# Expose port
EXPOSE 7879

USER nonroot

# Health check (GET /health — no DB access, no auth). No curl in distroless: node fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:'+(process.env.PORT||7879)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# Migrations run in CD (migrate job) before deploy, not at container start.
# node is PID 1, so SIGTERM triggers Nest shutdown hooks (Prisma disconnect, Telegram bot stop).
CMD ["dist/src/main.js"]
