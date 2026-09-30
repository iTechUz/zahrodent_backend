# Zahro Dental — Backend API Documentation

Manba: `backend/src` dagi **haqiqiy** controller, DTO va guard kodlari. Base URL: sizning serveringiz (masalan `http://localhost:3000`). Interaktiv UI: **`/swagger`** (Swagger UI).

---

## Umumiy qoidalar

### Autentifikatsiya

- **JWT Bearer**: `Authorization: Bearer <access_token>`
- Token **`POST /auth/login`** (yoki `/auth/refresh`) javobidagi `access_token`. Muddati `expires_in` soniya
  (standart 15 daqiqa, `JWT_EXPIRES_IN`). Muddat tugagach — `POST /auth/refresh` (pastda).
- Himoyalangan marshrutlarda token yo‘q yoki yaroqsiz bo‘lsa: **`401 Unauthorized`**, xabar: `Invalid or missing token` (JWT guard);
  eski/o‘chirilgan foydalanuvchi tokeni: `Token yangilanishi kerak — qayta kiring`.

### RBAC (rollar)

`JwtAuthGuard` + `RolesGuard` — `ROLES_STAFF` = `admin`, `doctor`, `receptionist`; `ROLES_FINANCE` = faqat `admin`; `ROLES_DOCTOR_WRITE` = `admin`, `doctor`.

| Modul | Marshrutlar | Kim kiradi |
|-------|-------------|------------|
| `patients`, `bookings`, `visits`, `services` | GET | **staff** (admin, doctor, receptionist) |
| `patients` | DELETE (soft delete), `POST /:id/restore`, `GET /:id?includeDeleted=true` | **faqat admin** |
| `settings` | GET | **staff** |
| `settings` | PATCH | **faqat admin** |
| `doctors` | GET `/doctors`, GET `/doctors/:id` | **staff** (doctor — faqat o‘qish) |
| `doctors` | POST, PATCH, DELETE, `/stats`, `/efficiency` | **faqat admin** |
| `services` | `/stats` | **admin, receptionist** |
| `notifications` | GET | **staff** (doctor — faqat `doctorId` = o‘zi bo‘lgan yozuvlar) |
| `notifications` | POST, `/send-reminders`, `/recipients`, `/bulk-send` | **admin, receptionist** |
| `analytics` | `/dashboard`, `/monthly`, `/sources` | **staff** (pul maydonlari faqat admin uchun, boshqalarga `null`) |
| `payments`, `users` | barcha | **faqat admin** (doctor/receptionist → **403** `Bu amal uchun ruxsat yo'q`) |
| `auth` | `login`, `refresh`, `logout` — ochiq; `me`, `password` — tizimga kirgan har qanday foydalanuvchi | |

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
  "success": false,
  "statusCode": 400,
  "message": "age: age must not be less than 1",
  "path": "/patients",
  "timestamp": "2026-04-14T12:00:00.000Z",
  "requestId": "0b6c3f0e-5c1b-4f7e-9d8a-2a9f7f1c1e11"
}
```

`requestId` — `X-Request-Id` javob headeri bilan bir xil (so‘rovda yuborilgan `X-Request-Id` `[A-Za-z0-9_.:-]{1,128}` bo‘lsa o‘sha).
Xato haqida xabar berishda shu id ni ko‘rsating — server loglarida har qatorda bor.

500 da `message` umumiy Uzbekcha xabar (ichki tafsilot faqat server logida). Prisma xatolari: `P2002` → **409**, `P2025` → **404**, `P2003` → **400** (DELETE da **409**).

---

## Modul: Auth

**Controller:** `AuthController` — prefix `/auth`. Rate limit (IP bo‘yicha): login 25/daqiqa, refresh 30/daqiqa, password 10/daqiqa.

| Method | Marshrut | Auth | Tavsif |
|--------|----------|------|--------|
| POST | `/auth/login` | ochiq | Telefon + parol → access + refresh token |
| POST | `/auth/refresh` | ochiq | Refresh token rotation → yangi juftlik |
| POST | `/auth/logout` | ochiq | Refresh tokenni bekor qilish (idempotent) |
| GET | `/auth/me` | Bearer | Joriy foydalanuvchi |
| PATCH | `/auth/password` | Bearer | O‘z parolini almashtirish |

### POST /auth/login → 201

**Body** (`LoginDto`): `phone` — `+998XXXXXXXXX`; `password` — string, min 1.

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "yhrk0LYe...(64 belgi, base64url)",
  "expires_in": 900,
  "user": {
    "id": "u1",
    "name": "Admin",
    "phone": "+998900000000",
    "role": "admin",
    "specialty": "…ixtiyoriy",
    "avatar": "…ixtiyoriy",
    "doctorId": "…faqat doctor roli uchun"
  }
}
```

- **401** `Telefon raqami yoki parol noto'g'ri` (noma’lum telefon va noto‘g‘ri parol uchun bir xil).
- **400** noto‘g‘ri telefon formati / bo‘sh parol.

### POST /auth/refresh → 200

**Body:** `{ "refresh_token": "<string, 1..512>" }` — javob login bilan **bir xil shakl**
(`access_token`, `refresh_token`, `expires_in`, `user`).

- Taqdim etilgan refresh token bekor qilinadi, o‘rniga yangisi beriladi (rotation). Har safar yangi `refresh_token` ni saqlang.
- **Bekor qilingan** token qayta yuborilsa — shu login’dan kelib chiqqan barcha tokenlar (family) bekor qilinadi.
- Muddati o‘tgan, noma’lum, bekor qilingan yoki foydalanuvchi o‘chirilgan: **401** `Sessiya muddati tugagan, qayta kiring`.
- Bir vaqtda faqat **bitta** refresh so‘rovi yuboring: bir token bilan parallel ikki so‘rov qayta ishlatish deb hisoblanadi.
- Refresh token muddati `REFRESH_TOKEN_TTL_DAYS` (standart 30 kun). Bazada faqat sha256 hash saqlanadi.

### POST /auth/logout → 200

**Body:** `{ "refresh_token": "..." }` → `{ "success": true }`. Token allaqachon bekor/noma’lum bo‘lsa ham `success: true`.
Access token muddati tugaguncha ishlaydi — mijoz uni o‘chirib tashlashi kerak.

### GET /auth/me → 200

```json
{ "id": "u1", "name": "Admin", "phone": "+998900000000", "role": "admin", "doctorId": null }
```

`doctorId` — doctor roli uchun Doctor yozuvi id si, boshqalar uchun `null`. Token yo‘q/yaroqsiz — **401**.

### PATCH /auth/password → 200

**Body:** `{ "currentPassword": "string (1..72)", "newPassword": "string (8..72)" }` → `{ "success": true }`.

- **400** `Joriy parol noto'g'ri`; **400** validatsiya (masalan `newPassword: Yangi parol kamida 8 belgidan iborat bo'lishi kerak`).
- Muvaffaqiyatda foydalanuvchining **barcha** refresh tokenlari bekor qilinadi (joriy sessiya ham — access token muddati
  tugagach qayta login kerak).

### Sessiyalarni bekor qilish (boshqa hollarda)

Admin `PATCH /users/:id` da parol yoki rolni o‘zgartirsa, `PATCH /doctors/:id` da shifokor login paroli yangilansa —
o‘sha foydalanuvchining refresh tokenlari bekor qilinadi. `DELETE /users/:id` — tokenlar kaskad bilan o‘chadi.

---

## Modul: Patients

**Controller:** `PatientsController` — `/patients`  
**Guard:** `JwtAuthGuard` + `RolesGuard` — staff rollar (yaratish: admin, receptionist; o‘chirish/tiklash: admin)

| Method | Marshrut | Query | Tavsif |
|--------|----------|-------|--------|
| GET | `/patients` | `page, limit, search, sortBy, order, source, startDate, endDate, debtOnly, doctorId` | Ro‘yxat (o‘chirilganlarsiz) |
| GET | `/patients/stats` | — | `{ total, newThisMonth, topSource }` (o‘chirilganlarsiz) |
| GET | `/patients/:id` | `includeDeleted=true` (faqat admin) | Bitta bemor |
| POST | `/patients` | — | Yaratish |
| PATCH | `/patients/:id` | — | Yangilash (tish xaritasi shu yerda) |
| DELETE | `/patients/:id` | — | **Soft delete** (admin) |
| POST | `/patients/:id/restore` | — | Tiklash (admin) |
| POST / GET | `/patients/:id/comments` | — | Izohlar |

### Bemor obyekti

```json
{
  "id": "cmu…",
  "firstName": "Ali",
  "lastName": "Valiyev",
  "age": 30,
  "phone": "+998901112233",
  "source": "walk-in",
  "notes": "",
  "address": "Toshkent",
  "workplace": "IT",
  "avatar": "…ixtiyoriy",
  "balance": -150000,
  "createdAt": "2026-06-01",
  "assignedDoctorId": null,
  "assignedDoctor": { "firstName": "Aziz", "lastName": "Karimov" },
  "toothChart": {},
  "telegramConnected": false,
  "deletedAt": null
}
```

- `telegramConnected` — bemor Telegram botga o‘z raqamini yuborgan (eslatmalar bot orqali boradi).
- `deletedAt` — ISO vaqt yoki `null`; faqat `includeDeleted=true` bilan olingan o‘chirilgan bemorda to‘ldirilgan.

### DELETE /patients/:id — soft delete → 200 `{ "id": "<id>" }`

- `deleted_at` qo‘yiladi (409 endi qaytmaydi — tarixli bemor ham o‘chiriladi).
- Bemor barcha ro‘yxat, statistika, qidiruv, qarzdorlar, analitika, eslatma va SMS qabul qiluvchilar ro‘yxatidan chiqadi.
- Bugundan boshlab (Asia/Tashkent) `pending`/`confirmed` qabullari `cancelled` qilinadi.
- Tashriflar, to‘lovlar va o‘tgan qabullar saqlanadi; ularda `patient.deletedAt` to‘ldirilgan holda ism ko‘rinadi.
- O‘chirilgan bemorga yangi qabul/tashrif/to‘lov bog‘lab bo‘lmaydi — **404** `So'ralgan yoki bog'langan yozuv topilmadi`.
- O‘chirilgan bemor uchun `GET /:id`, `PATCH`, izohlar, qayta `DELETE` — **404** `Bemor topilmadi`.

### GET /patients/:id?includeDeleted=true

Faqat admin uchun o‘chirilgan bemorni qaytaradi (`deletedAt` bilan). Boshqa rollar uchun parametr e’tiborsiz (404).

### POST /patients/:id/restore → 200

`deletedAt` tozalanadi, bemor obyekti qaytadi. Bekor qilingan qabullar avtomatik tiklanmaydi. O‘chirilmagan bemor uchun
ham 200 (idempotent). Topilmasa **404**.

### POST /patients

**Body** (`CreatePatientDto`): `firstName`, `lastName` (min 1), `age` (int ≥ 1), `phone` (`+?[\d\s-]{10,20}`),
`source` (`walk-in` | `telegram` | `website` | `phone`), `address` (min 3), `workplace` (min 1); ixtiyoriy `notes`,
`avatar`, `assignedDoctorId`, `toothChart`.

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

**Javob:** `id`, `patientId`, `doctorId`, `date` (YYYY-MM-DD), `time`, `source`, `status`, `notes?`, `createdAt`, `serviceId?`,
`patient: { firstName, lastName, deletedAt }` (o‘chirilgan bemor qabullarida ham ism saqlanadi, `deletedAt` — ISO yoki `null`).

`visits` va `payments` javoblarida ham xuddi shunday `patient: { firstName, lastName, deletedAt }` maydoni bor
(ro‘yxat, bitta yozuv, yaratish va yangilash javoblari).

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
| POST | `/notifications/send-reminders` | Pending/confirmed qabullar uchun eslatmalar (Telegram yoki SMS) |
| GET | `/notifications/recipients` | Eslatma/SMS qabul qiluvchilar |
| POST | `/notifications/bulk-send` | Ommaviy xabar |

### POST /notifications — Body (`CreateNotificationDto`)

| Maydon | Qoidalar |
|--------|----------|
| `patientId` | string, min 1 |
| `type` | `sms` \| `telegram` |
| `message` | string, min 1 |
| `status` | ixtiyoriy: `sent` \| `delivered` \| `failed` |
| `sentAt` | ixtiyoriy ISO string |

### POST /notifications/send-reminders

**Body:** bo‘sh JSON `{}`.

**Javob:**

```json
{ "created": 4, "smsSent": 1, "smsFailed": 1, "telegramSent": 1, "telegramFailed": 0, "skipped": 1 }
```

- Oyna: bugundan `bugun + reminderDaysAhead` gacha (Asia/Tashkent, `/settings`, standart 1 — bugun va ertaga),
  `pending` / `confirmed`, `reminderSentAt: null`, bemor o‘chirilmagan.
- Kanal: bemorda `telegram_chat_id` bor va bot shu jarayonda ishlayapti → Telegram (`telegramReminderTemplate`);
  aks holda Eskiz SMS (`smsReminderTemplate`). Telegram xatosi SMS ga o‘tkazilmaydi.
- `reminderSentAt` faqat haqiqatan yuborilganlar uchun yoziladi; xatolar `failed` yozuv bo‘lib qoladi va keyingi
  safar qayta uriniladi. Bitta xato butun partiyani to‘xtatmaydi.
- `skipped` — Eskiz sozlanmagan, yuborishga urinilmagan (`failed` yozuv).

### Bulk send / recipients

- `GET /notifications/recipients?targetType=patient|doctor&startDate&endDate` — o‘chirilgan bemorlar qabullari kirmaydi.
- `POST /notifications/bulk-send { targetIds, targetType, message }` → `{ sent, failed, total }`. `[bemor]`, `[sana]`,
  `[vaqt]` almashtiriladi. Telegram’ga ulangan bemorlarga (bot ishlayotgan bo‘lsa) Telegram orqali, qolganlarga SMS.
  O‘chirilgan bemorlar o‘tkazib yuboriladi. Shifokorga yuborilgan SMS bemor qabulini belgilamaydi.

---

## Modul: Settings

**Controller:** `SettingsController` — `/settings`. Bitta qatorli `clinic_settings` jadvali.

| Method | Marshrut | Rollar |
|--------|----------|--------|
| GET | `/settings` | admin, doctor, receptionist |
| PATCH | `/settings` | faqat admin |

### GET /settings → 200

```json
{
  "clinicName": "Zahro Dental",
  "address": "",
  "phone": "",
  "workingHours": "",
  "smsReminderTemplate": "Hurmatli {name}, {date} kuni soat {time} da {doctor} qabuliga yozilgansiz. Zahro Dental",
  "telegramReminderTemplate": "Hurmatli {name}, {date} kuni soat {time} da {doctor} qabuliga yozilgansiz. Zahro Dental",
  "reminderDaysAhead": 1
}
```

### PATCH /settings → 200 (yangilangan obyekt)

Qisman — faqat yuborilgan maydonlar o‘zgaradi:

| Maydon | Qoidalar |
|--------|----------|
| `clinicName` | string, 1..100 |
| `address` | string, ≤ 300 |
| `phone` | string, ≤ 50 |
| `workingHours` | string, ≤ 200 |
| `smsReminderTemplate`, `telegramReminderTemplate` | string, 1..500 |
| `reminderDaysAhead` | int, 0..7 (0 — faqat bugun) |

Placeholderlar: `{name}` — bemor ism familiyasi, `{date}` — `DD.MM.YYYY`, `{time}` — `HH:mm`, `{doctor}` — shifokor
ism familiyasi, `{clinic}` — `clinicName`. Noma’lum `{...}` o‘zgarishsiz qoladi.
Noto‘g‘ri qiymat — **400**; admin bo‘lmasa — **403** `Bu amal uchun ruxsat yo'q`.

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

`npm run prisma:seed` (`prisma/seed.ts`, faqat development — **barcha jadvallarni tozalaydi**, `NODE_ENV=production` da
ishlamaydi) admin foydalanuvchini `.env` dagi `INITIAL_ADMIN_PHONE` / `INITIAL_ADMIN_PASSWORD` / `INITIAL_ADMIN_NAME`
bilan qayta yaratadi (boshqa ma'lumot qo'shmaydi). Productionda seed ishlatilmaydi — birinchi admin server startida
`INITIAL_ADMIN_*` dan yaratiladi.

---

*Hujjat koddagi controller/DTO/guard'lar bilan moslashtirilgan (2026-09-30). Swagger `/swagger` da JWT **Authorize** bilan sinab ko‘rish mumkin.*
