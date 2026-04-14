# Test strategiyasi (backend)

## Turli testlar

| Tur | Joylashuv | Maqsad |
|-----|-----------|--------|
| **Unit** | `src/**/*.spec.ts` | Servis mantiq, mock repository |
| **E2E (Supertest)** | `test/*.e2e-spec.ts` | HTTP + Prisma + JWT + RBAC |

## Ishga tushirish

```bash
# Unit (DB talab qilmaydi)
npm test

# E2E — DATABASE_URL bo'lishi kerak (odatda .env)
npm run test:e2e
```

## E2E talablar

- `DATABASE_URL` — migratsiya qilingan va **seed** ishga tushirilgan DB (`npx prisma migrate deploy` + `npm run prisma:seed`) tavsiya etiladi.
- E2E **haqiqiy DB** ga yozishi mumkin (masalan vaqtinchalik bemorni yaratish/o‘chirish). Production DB da **ishlatmang**.

## Qamrov (coverage)

```bash
npm run test:cov
```

Maqsad:

- **Auth:** login muvaffaqiyat/xato, DTO 400
- **JWT:** himoyalangan marshrutlarda 401
- **RBAC:** `POST /doctors` receptionist bilan 403
- **CRUD:** asosiy GET/404, validatsiya 400
- **Servislar:** filtrlash va xarita (`bookings`, `notifications.sendReminders`) unit testda

Kengaytirish: alohida `TEST_DATABASE_URL` va `prisma migrate reset --force` bilan tozalash CI da.
