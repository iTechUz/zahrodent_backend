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
| `patients`, `bookings`, `visits`, `services` | GET | **staff** (admin, doctor, receptionist) |
| `patients` | DELETE | **faqat admin** (tashrif/to‘lov tarixi bo‘lsa **409**) |
| `doctors` | GET `/doctors`, GET `/doctors/:id` | **staff** (doctor — faqat o‘qish) |
| `doctors` | POST, PATCH, DELETE, `/stats`, `/efficiency` | **faqat admin** |
| `services` | `/stats` | **admin, receptionist** |
| `notifications` | GET | **staff** (doctor — faqat `doctorId` = o‘zi bo‘lgan yozuvlar) |
| `notifications` | POST, `/send-reminders`, `/recipients`, `/bulk-send` | **admin, receptionist** |
| `analytics` | `/dashboard`, `/monthly`, `/sources` | **staff** (pul maydonlari faqat admin uchun, boshqalarga `null`) |
| `payments`, `users` | barcha | **faqat admin** (doctor/receptionist → **403**) |

**Doctor scope:** `doctor` roli faqat o‘z bemorlari (biriktirilgan / qabul / tashrif orqali), o‘z qabullari va tashriflarini ko‘radi. Doctor hisobiga `Doctor` yozuvi bog‘lanmagan bo‘lsa — **403** (`Shifokor profili topilmadi…`), hech qachon butun klinika ma’lumoti emas. Doctor tashrif yaratsa `doctorId` doim o‘zining id si bo‘ladi.

### Ro‘yxat parametrlari (barcha list endpointlar)

- `page` (0 dan, standart 0), `limit` (**1–100**, standart 10), `search` (≤100 belgi).
- `sortBy` — resursga xos oq ro‘yxat, `order` — `asc` | `desc`. Hech biri berilmasa standart tartib o‘zgarmaydi; faqat `order` — standart maydonga; faqat `sortBy` — `asc`.
  - patients: `createdAt, firstName, lastName, age, source` · bookings: `date, time, createdAt, status, source` · visits: `date, status, price` · payments: `date, amount, status, method, type` · services: `name, category, price, duration` · leads: `createdAt, updatedAt, name, status, source` · doctors: `firstName, lastName, specialty` · users: `createdAt, name, role, phone` (users — faqat `sortBy`/`order`, javob massiv).
- Filtrlar: patients `source, startDate, endDate, debtOnly=true|false, doctorId`; bookings `status, source, patientId, doctorId, dateRange=today|week|month|all, startDate, endDate`; visits `patientId, doctorId, status, startDate, endDate`; payments `status, method, type, patientId, dateRange, startDate, endDate`; services `category`; doctors `specialty`; leads `status, source, startDate, endDate`. Sanalar `YYYY-MM-DD`, kunlar **Asia/Tashkent** bo‘yicha.
- Noma’lum parametr, noto‘g‘ri tur yoki qiymat → **400**.

### Balans / qarz

`balance = Σ INCOME to‘lovlar (paid|partial) + Σ INCOME chegirmalar − Σ yakunlangan tashriflar narxi`. `balance < 0` — qarzdor (`debtOnly=true`, `payments/stats.pendingAmount`, `analytics.unpaidTotal/unpaidCount`). EXPENSE to‘lovlar balansga va daromadga kirmaydi.

### JWT payload

Access token ichida: `sub` (user id), `role`, `phone`, `name`, ixtiyoriy `specialty`, `avatar`, `doctorId`. Har so‘rovda foydalanuvchi DB dan qayta o‘qiladi — rol va `doctorId` DB dagi qiymat; o‘chirilgan foydalanuvchi tokeni darhol **401**. Eski/noto‘g‘ri tokenlar **401** — qayta login.

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

500 da `message` umumiy Uzbekcha xabar (ichki tafsilot faqat server logida). Prisma xatolari: `P2002` → **409**, `P2025` → **404**, `P2003` → **400** (DELETE da **409**).

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

**Javob:** `{ "created", "smsSent", "smsFailed", "skipped" }`. Faqat **bugungi va ertangi** (Asia/Tashkent) `pending` / `confirmed` va **`reminderSentAt: null`** qabullar olinadi. **`reminderSentAt`** faqat haqiqatan yuborilgan SMS lar uchun yoziladi — ular qayta yuborilmaydi; xato bo‘lganlari keyingi safar qayta urinadi. Bitta SMS xatosi (tarmoq/timeout) butun partiyani to‘xtatmaydi.

**Eskiz.uz SMS:** `ESKIZ_EMAIL` va `ESKIZ_PASSWORD` sozlangan bo‘lsa SMS `notify.eskiz.uz` orqali yuboriladi. Sozlanmagan bo‘lsa yoki bemor manbasi `telegram` bo‘lsa (Telegram kanal hali yo‘q) — yozuv `failed` sifatida saqlanadi (`skipped`), qabul belgilanmaydi. `bulk-send` da ham xuddi shunday; shifokorga yuborilgan SMS bemor qabulini belgilamaydi.

---

## Modul: Analytics

**Guard:** JWT + staff. Doctor — faqat o‘z bemorlari/qabullari. Pul maydonlari faqat **admin** uchun, qolganlarga `null`.

- `GET /analytics/dashboard?date=YYYY-MM-DD` (standart — bugun, Asia/Tashkent) →
  `{ totalPatients, newPatientsThisMonth, todayBookings, todayCompleted, pendingBookings, activeDoctors, totalDoctors, todayRevenue, monthRevenue, monthExpenses, unpaidTotal, unpaidCount }`
- `GET /analytics/monthly?months=6` (1–24) → `[{ month: "YYYY-MM", newPatients, bookings, completedBookings, revenue, expenses }]` — eskidan yangiga, bo‘sh oylar ham.
- `GET /analytics/sources?type=bookings|patients` (standart `bookings`) → `[{ source, count }]`, ko‘pdan kamga.

## WebSocket (Socket.IO)

Ulanishda JWT majburiy: `io(url, { auth: { token } })` (yoki `Authorization: Bearer` header / `?token=`). Token yo‘q/yaroqsiz yoki foydalanuvchi o‘chirilgan bo‘lsa server `unauthorized` hodisasini yuborib ulanishni uzadi. `newLead` hodisasi faqat admin va receptionist ga yuboriladi.

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
