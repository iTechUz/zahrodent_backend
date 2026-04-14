# Zahro Dental Hub — Backend (API)

Bu `backend/` NestJS + Prisma asosidagi REST API bo‘lib, Zahro Dental admin paneli uchun ishlaydi.

## Tez havolalar

- **DevOps runbook (PM2, Nginx, deploy)**: `../DEVOPS.md`
- **API contract**: `docs/API.md`
- **Test qo‘llanma**: `docs/TESTING.md`

## Stack

- **NestJS** (Node.js)
- **Prisma** (PostgreSQL)
- **JWT auth** + role-based access (RBAC)
- **Swagger**: `/swagger` (prod’da default o‘chiq)

## Konfiguratsiya (env)

Namuna: `.env.example`

Minimal production env:
- `NODE_ENV=production`
- `DATABASE_URL=...`
- `JWT_SECRET=...` (kamida 32 belgi, random)
- `JWT_EXPIRES_IN=7d`
- `PORT=3000`
- `HOST=0.0.0.0`
- `TRUST_PROXY=1` (nginx/load balancer ortida)
- `PUBLIC_BASE_URL=https://api.example.com`
- `CORS_ORIGINS=https://app.example.com`

Eslatma: production’da `CORS_ORIGINS` bo‘sh bo‘lsa app start bo‘lmaydi (xavfsizlik uchun).

## Lokal dev (DB + migrate + seed)

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

## Production (build + migrate + run)

```bash
cd backend
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run build
NODE_ENV=production node dist/src/main.js
```

## Healthcheck

- `GET /health` → `{ status: "ok", timestamp: "..." }`

## Swagger

- Dev: odatda yoqilgan → `http://localhost:3000/swagger`
- Prod: default o‘chiq. Yoqish: `SWAGGER_ENABLED=true`
