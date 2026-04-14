# Zahro Dental — Backend API Documentation

Manba: `backend/src` dagi **haqiqiy** controller, DTO va guard kodlari. Base URL: sizning serveringiz (masalan `http://localhost:3000`). Interaktiv UI: **`/swagger`** (Swagger UI).

---

## Umumiy qoidalar

### Autentifikatsiya

- **JWT Bearer**: `Authorization: Bearer <access_token>`
- Token **`POST /auth/login`** javobidagi `access_token` maydoni.
- Himoyalangan marshrutlarda token yo‘q yoki yaroqsiz bo‘lsa: **`401 Unauthorized`**, xabar: `Invalid or missing token` (JWT guard).

### RBAC (rollar)

`JwtAuthGuard` + `RolesGuard` — `ROLES_STAFF` = `admin`, `doctor`, `receptionist`; `ROLES_FINANCE` = faqat `admin`; `ROLES_DOCTOR_WRITE` = `admin`, `doctor`.

| Modul | Marshrutlar | Kim kiradi |
|-------|-------------|------------|
| `patients`, `bookings`, `visits`, `services`, `notifications` | barcha | **staff** (admin, doctor, receptionist) |
| `doctors` | GET | **staff** |
| `doctors` | POST, PATCH, DELETE | **admin, doctor** (receptionist → **403**) |
| `payments` | barcha | **faqat admin** (doctor/receptionist → **403**) |

Ro‘yxat endpointlarida ixtiyoriy **`limit`** query (butun son, 1–500): `GET /patients`, `GET /bookings`, `GET /payments` — server javobni cheklaydi.

### JWT payload

Access token ichida (strategiya DB ga qayta so‘ramaydi): `sub` (user id), `role`, `email`, `name`, ixtiyoriy `specialty`, `avatar`. Eski tokenlar (faqat `sub`+`role`) **401** — qayta login.

### Validatsiya

Global `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`, `enableImplicitConversion`.

- Noto‘g‘ri yoki taqiqlangan maydon: **400 Bad Request**, `message` — string yoki string[] (class-validator).

### HTTP status kodlar (NestJS)

- Ko‘p **POST** handlerlar default holda **201 Created** qaytaradi (masalan `POST /auth/login`, `POST /patients`).
- **GET** odatda **200**; topilmasa **404**.

### Xato formati (`AllExceptionsFilter`)

Barcha HTTP xatolari va filtr orqali:

```json
{
  "statusCode": 400,
  "path": "/patients",
  "timestamp": "2026-04-14T12:00:00.000Z",
  "message": "Bad Request"
}
```

500 da `message` odatda `Internal server error`.

---

## Modul: Auth

**Controller:** `AuthController` — prefix `/auth`  
**Guard:** yo‘q

| Method | Marshrut | Tavsif |
|--------|----------|--------|
| POST | `/auth/login` | Email/parol, JWT va foydalanuvchi profili |

### POST /auth/login

**Body** (`LoginDto`):

| Maydon | Tur | Qoidalar |
|--------|-----|----------|
| `email` | string | `@IsEmail()` |
| `password` | string | `@IsString()`, `@MinLength(1)` |

**Muvaffaqiyat (200):**

```json
{
  "access_token": "<jwt>",
  "user": {
    "id": "u1",
    "name": "Dr. Zahro Admin",
    "email": "admin@zahro.dental",
    "role": "admin",
    "specialty": "...",
    "avatar": "..."
  }
}
```

**401:** noto‘g‘ri email yoki parol — xabar: `Email yoki parol noto'g'ri` (`UnauthorizedException`).

**400:** bo‘sh yoki noto‘g‘ri DTO.

---

## Modul: Patients

**Controller:** `PatientsController` — `/patients`  
**Guard:** `JwtAuthGuard` + `RolesGuard` — staff rollar

| Method | Marshrut | Query | Tavsif |
|--------|----------|-------|--------|
| GET | `/patients` | `search?`, `limit?` | Ro‘yxat, ixtiyoriy qidiruv |
| GET | `/patients/:id` | — | Bitta bemor |
| POST | `/patients` | — | Yaratish |
| PATCH | `/patients/:id` | — | Yangilash (tish xaritasi shu yerda) |
| DELETE | `/patients/:id` | — | O‘chirish |

### GET /patients

- **Query:** `search` (ixtiyoriy) — `firstName`, `lastName`, `phone` bo‘yicha `contains` (case insensitive).

**Javob (200):** `Patient` obyektlari massivi (service `toResponse`: `id`, `firstName`, `lastName`, `age`, `phone`, `source`, `notes`, `avatar?`, `createdAt` (YYYY-MM-DD), `allergies?`, `bloodType?`, `toothChart?`).

### GET /patients/:id

- **404:** `Patient not found`

### POST /patients

**Body** (`CreatePatientDto`):

| Maydon | Majburiy | Qoidalar |
|--------|----------|----------|
| `firstName` | ha | string, min 1 |
| `lastName` | ha | string, min 1 |
| `age` | ha | int ≥ 1 |
| `phone` | ha | `+?[\d\s-]{10,20}` |
| `source` | ha | `walk-in` \| `telegram` \| `website` \| `phone` |
| `notes`, `allergies`, `bloodType`, `avatar` | yo‘q | string |
| `toothChart` | yo‘q | object |

**200:** yaratilgan bemor (yoki Nest default 201 — kodda `return` service natijasi, status controllerda implicit 200/201).

### PATCH /patients/:id

**Body:** `UpdatePatientDto` — `PartialType(CreatePatientDto)` (barcha maydonlar ixtiyoriy).

### DELETE /patients/:id

**Javob:** `{ "id": "<id>" }`

---

## Modul: Doctors

**Controller:** `DoctorsController` — `/doctors`  
**Guard:** `JwtAuthGuard` + `RolesGuard`; klass darajasida staff; **POST/PATCH/DELETE** — `ROLES_DOCTOR_WRITE`

| Method | Marshrut | Auth / RBAC |
|--------|----------|-------------|
| GET | `/doctors` | JWT |
| GET | `/doctors/:id` | JWT |
| POST | `/doctors` | JWT + admin yoki doctor |
| PATCH | `/doctors/:id` | JWT + admin yoki doctor |
| DELETE | `/doctors/:id` | JWT + admin yoki doctor |

### POST /doctors — Body (`CreateDoctorDto`)

| Maydon | Qoidalar |
|--------|----------|
| `name` | string, min 1 |
| `specialty` | string, min 1 |
| `phone` | `+?[\d\s-]{10,20}` |
| `workingHours` | string, min 1 |
| `avatar` | ixtiyoriy string |
| `schedule` | ixtiyoriy `Record<string, unknown>[]` |
| `daysOff` | ixtiyoriy `string[]` |

**403:** receptionist yoki boshqa rol (guard bo‘yicha faqat admin/doctor).

### PATCH /doctors/:id

**Body:** `UpdateDoctorDto` — `PartialType(CreateDoctorDto)`.

---

## Modul: Bookings

**Controller:** `BookingsController` — `/bookings`  
**Guard:** `JwtAuthGuard` + `RolesGuard` — staff

| Method | Marshrut | Query |
|--------|----------|-------|
| GET | `/bookings` | `search?`, `status?`, `source?`, `patientId?`, `limit?` |
| GET | `/bookings/:id` | — |
| POST | `/bookings` | — |
| PATCH | `/bookings/:id` | — |
| DELETE | `/bookings/:id` | — |

### GET /bookings — filtrlash (service mantiq)

- `patientId` — aniq `patientId`
- `status` — agar `all` bo‘lmasa, shu status
- `source` — agar `all` bo‘lmasa, shu manba
- `search` — bemorni `firstName` / `lastName` bo‘yicha qidiruv

**Javob:** `id`, `patientId`, `doctorId`, `date` (YYYY-MM-DD), `time`, `source`, `status`, `notes?`, `createdAt`, `serviceId?`.

### POST /bookings — Body (`CreateBookingDto`)

| Maydon | Qoidalar |
|--------|----------|
| `patientId`, `doctorId` | string, min 1 |
| `date` | string, min 10 (YYYY-MM-DD) |
| `time` | string, min 1 |
| `source` | `walk-in` \| `telegram` \| `website` \| `phone` |
| `status` | `pending` \| `confirmed` \| `arrived` \| `no-show` \| `completed` \| `cancelled` |
| `notes`, `serviceId` | ixtiyoriy |

---

## Modul: Visits

**Controller:** `VisitsController` — `/visits`  
**Guard:** `JwtAuthGuard` + `RolesGuard` — staff

| Method | Marshrut | Query |
|--------|----------|-------|
| GET | `/visits` | `patientId?`, `doctorId?` |
| GET | `/visits/:id` | — |
| POST | `/visits` | — |
| PATCH | `/visits/:id` | — |

### POST /visits — Body (`CreateVisitDto`)

| Maydon | Qoidalar |
|--------|----------|
| `patientId`, `doctorId` | majburiy string |
| `bookingId` | ixtiyoriy |
| `date` | ixtiyoriy YYYY-MM-DD (yo‘q bo‘lsa — server sanasi) |
| `status` | `not-started` \| `in-progress` \| `completed` |
| `diagnosis`, `treatment`, `notes` | ixtiyoriy |

---

## Modul: Services

**Controller:** `ServicesController` — `/services`  
**Guard:** `JwtAuthGuard` + `RolesGuard` — staff

| Method | Marshrut | Query |
|--------|----------|-------|
| GET | `/services` | `search?`, `category?` (`all` yoki kategoriya) |
| GET | `/services/:id` | — |
| POST | `/services` | — |
| PATCH | `/services/:id` | — |
| DELETE | `/services/:id` | — |

### POST /services — Body (`CreateServiceDto`)

| Maydon | Qoidalar |
|--------|----------|
| `name`, `category` | string, min 1 |
| `price`, `duration` | int ≥ 1 |
| `description` | ixtiyoriy string |

---

## Modul: Payments

**Controller:** `PaymentsController` — `/payments`  
**Guard:** `JwtAuthGuard` + `RolesGuard` — **faqat admin**

| Method | Marshrut | Query |
|--------|----------|-------|
| GET | `/payments` | `search?`, `status?`, `patientId?`, `limit?` |
| GET | `/payments/:id` | — |
| POST | `/payments` | — |
| PATCH | `/payments/:id` | — |
| DELETE | `/payments/:id` | — |

### POST /payments — Body (`CreatePaymentDto`)

| Maydon | Qoidalar |
|--------|----------|
| `patientId` | string, min 1 |
| `amount` | int ≥ 1 |
| `method` | `cash` \| `card` \| `transfer` \| `insurance` |
| `status` | `paid` \| `partial` \| `unpaid` |
| `description` | string, min 3 |
| `discount` | ixtiyoriy int ≥ 0 |
| `serviceId` | ixtiyoriy |
| `date` | ixtiyoriy YYYY-MM-DD |

---

## Modul: Notifications

**Controller:** `NotificationsController` — `/notifications`  
**Guard:** `JwtAuthGuard` + `RolesGuard` — staff

| Method | Marshrut | Tavsif |
|--------|----------|--------|
| GET | `/notifications` | Tarix |
| POST | `/notifications` | Bitta yozuv yaratish |
| POST | `/notifications/send-reminders` | Pending/confirmed qabullar uchun eslatmalar (bulk) |

### POST /notifications — Body (`CreateNotificationDto`)

| Maydon | Qoidalar |
|--------|----------|
| `patientId` | string, min 1 |
| `type` | `sms` \| `telegram` |
| `message` | string, min 1 |
| `status` | ixtiyoriy: `sent` \| `delivered` \| `failed` |
| `sentAt` | ixtiyoriy ISO string |

### POST /notifications/send-reminders

**Body:** bo‘sh JSON `{}` yoki content-type bilan mos body.

**Javob (201 yoki 200):** `{ "created": <number> }` — yaratilgan bildirishnoma yozuvlari soni. Faqat **`reminderSentAt: null`** bo‘lgan `pending` / `confirmed` qabullar olinadi. **`reminderSentAt`** faqat muvaffaqiyatli yakunlangan eslatmalar uchun yoziladi (SMS muvaffaqiyatsiz yoki telefon noto‘g‘ri bo‘lsa — qayta urinish mumkin).

**Eskiz.uz SMS:** serverda `ESKIZ_EMAIL` va `ESKIZ_PASSWORD` (ixtiyoriy `ESKIZ_FROM`) sozlangan bo‘lsa, manbai `telegram` bo‘lmagan bemorlar uchun SMS **haqiqiy** `notify.eskiz.uz` orqali yuboriladi. Sozlanmagan bo‘lsa, yozuvlar bazada `sent` holatida saqlanadi (simulyatsiya). Muvaffaqiyatli javobda qo‘shimcha: `{ "created", "smsSent", "smsFailed" }`.

---

## Seed foydalanuvchilar (lokal test)

`prisma/seed.ts` (ishlab chiqish uchun):

| Email | Rol |
|-------|-----|
| `admin@zahro.dental` | admin |
| `kamila@zahro.dental`, `farrukh@zahro.dental` | doctor |
| `gulnora@zahro.dental`, `madina@zahro.dental` | receptionist |

Parollar seed faylida; productionda **hech qachon** seed parollarini ishlatmang.

---

*Hujjat versiyasi: koddan avtomatik moslashtirilgan. Swagger `/swagger` da JWT **Authorize** bilan sinab ko‘rish mumkin.*
