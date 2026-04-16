# Zahro Dental Backend API — Documentation

## Umumiy ma'lumot

**Loyiha:** Zahro Dental — Stomatologiya klinikasi boshqaruv tizimi backend API  
**Framework:** NestJS (Node.js)  
**Til:** TypeScript  
**Port:** `4000`  
**API prefix:** `/api`  
**Swagger UI:** `/swagger` (Basic Auth: `eljahon` / `1315`)

---

## Texnologiyalar

| Komponent | Texnologiya | Versiya |
|-----------|-------------|---------|
| Framework | NestJS | ^10.3.2 |
| Til | TypeScript | ^5.3.3 |
| Ma'lumotlar bazasi | PostgreSQL | — |
| ORM | Prisma | ^6.2.1 |
| Autentifikatsiya | JWT (passport-jwt) | — |
| Fayl saqlash | MinIO (S3-compatible) | — |
| API hujjatlar | Swagger / OpenAPI | — |
| Parol hashlash | bcrypt, Argon2 | — |
| Validatsiya | class-validator | ^0.14.1 |
| Vaqt | dayjs (Asia/Tashkent) | ^1.11.12 |

---

## Loyiha tuzilmasi

```
src/
├── api/
│   ├── auth/           # Autentifikatsiya
│   ├── users/          # Foydalanuvchilar
│   ├── branch/         # Filiallar
│   ├── patient/        # Bemorlar
│   ├── roles/          # Rollar va ruxsatlar
│   ├── notifications/  # Bildirishnomalar
│   ├── file-upload/    # Fayl yuklash
│   ├── minio/          # MinIO storage xizmati
│   ├── date-time/      # Vaqt yordamchisi
│   └── jwt.check.controller.ts  # Asosiy JWT controller
├── guards/
│   ├── jwt.guard.ts           # JWT himoyasi
│   └── check.role.groard.ts   # Rol tekshiruvi
├── decorators/
│   └── user.decorator.ts      # @CurrentUser()
├── config/
│   ├── jwt.config.ts
│   └── api-key-config.ts
├── utils/
│   ├── hashing/          # Parol hashlash
│   ├── paginations.ts    # Sahifalash yordamchisi
│   └── i18n.ts
├── validator/
│   └── cuid.ts           # CUID validator
├── constantis/index.ts   # Konstantalar
├── prisma.service.ts     # Prisma ulanish xizmati
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma   # Ma'lumotlar bazasi sxemasi
└── seed.ts         # Boshlang'ich ma'lumotlar
```

---

## Ma'lumotlar bazasi modellari

### User
```
id              String   (CUID, PK)
phone           String?  (unique)
firstName       String?
lastName        String?
password        String?
image           String?
status          UserStatus (ACTIVE | DELETED)
statusChangedAt DateTime?
statusReason    String?
roleId          String   (FK → Roles)
currentBranchId String?
createdAt       DateTime
updatedAt       DateTime
```

### Roles
```
id          String   (CUID, PK)
name        String   (unique)
createdAt   DateTime
updatedAt   DateTime
```

### Permission
```
id        String   (CUID, PK)
name      String
roleId    String   (FK → Roles)
read      Boolean (default: true)
view      Boolean (default: true)
create    Boolean (default: true)
remove    Boolean (default: true)
update    Boolean (default: true)
filter    Boolean (default: true)
print     Boolean (default: true)
share     Boolean (default: true)
export    Boolean (default: true)
import    Boolean (default: true)
upload    Boolean (default: true)
restore   Boolean (default: true)
```

### Branch
```
id          String   (CUID, PK)
name        String
description String?
address     String?
phone       String?
createdAt   DateTime
updatedAt   DateTime
```

---

## API Endpointlar

### Autentifikatsiya `/api/auth`

| Method | Endpoint | Auth | Tavsif |
|--------|----------|------|--------|
| POST | `/auth/login` | Yo'q | Foydalanuvchi login |
| POST | `/auth/change-password` | Yo'q | Parolni o'zgartirish |

**POST /auth/login**
```json
// Request
{ "phone": "+998901234567", "password": "secret" }

// Response
{ "token": "<jwt_token>", "branches": [...] }
```

**POST /auth/change-password**
```json
{ "phone": "+998901234567", "oldPassword": "old", "newPassword": "new" }
```

---

### Foydalanuvchilar `/api/users`

| Method | Endpoint | Auth | Tavsif |
|--------|----------|------|--------|
| GET | `/users` | JWT | Barcha foydalanuvchilar (sahifalash) |
| GET | `/users/me` | JWT | Joriy foydalanuvchi |
| GET | `/users/number-of-users` | JWT | Foydalanuvchilar statistikasi |
| GET | `/users/:id` | JWT | Bitta foydalanuvchi |
| POST | `/users` | JWT | Foydalanuvchi yaratish |
| PUT | `/users/:id` | JWT | Foydalanuvchini yangilash |
| PATCH | `/users/:branchId` | JWT | Joriy filialni o'rnatish |
| DELETE | `/users/:id` | JWT | Foydalanuvchini o'chirish (soft) |

**POST /users — Request Body**
```json
{
  "phone": "+998901234567",
  "firstName": "Ali",
  "lastName": "Valiyev",
  "password": "secret",
  "image": "filename.jpg",
  "roleId": "cuid...",
  "currentBranchId": "cuid...",
  "branchIds": ["cuid1", "cuid2"]
}
```

**GET /users — Query Params**
```
page       (default: 1)
pageSize   (default: 10, max: 100)
search     (string)
sortBy     (ASC | DESC)
roleId     (CUID, optional)
```

---

### Filiallar `/api/branch`

| Method | Endpoint | Auth | Tavsif |
|--------|----------|------|--------|
| GET | `/branch` | JWT | Barcha filiallar |
| GET | `/branch/:id` | JWT | Bitta filial |
| POST | `/branch` | JWT | Filial yaratish |
| PUT | `/branch/:id` | JWT | Filialni yangilash |
| DELETE | `/branch/:id` | JWT | Filialni o'chirish |

**POST /branch — Request Body**
```json
{
  "name": "Chilonzor filiali",
  "address": "Chilonzor 7-kvartal",
  "phone": "+998711234567",
  "description": "Asosiy filial"
}
```

---

### Rollar `/api/roles`

| Method | Endpoint | Auth | Tavsif |
|--------|----------|------|--------|
| GET | `/roles` | JWT | Barcha rollar |
| GET | `/roles/some` | JWT | Tizim rollarsiz rollar |
| GET | `/roles/:id` | JWT | Rol va uning ruxsatlari |
| POST | `/roles` | JWT | Rol yaratish |
| DELETE | `/roles/:id` | JWT | Rolni o'chirish |

---

### Bemorlar `/api/patients`

| Method | Endpoint | Auth | Tavsif |
|--------|----------|------|--------|
| GET | `/patients` | JWT | Barcha bemorlar |
| GET | `/patients/:id` | JWT | Bitta bemor |
| POST | `/patients` | JWT | Bemor yaratish |
| PUT | `/patients/:id` | JWT | Bemorni yangilash |
| DELETE | `/patients/:id` | JWT | Bemorni o'chirish |

---

### Bildirishnomalar `/api/notifications`

| Method | Endpoint | Auth | Tavsif |
|--------|----------|------|--------|
| GET | `/notifications` | JWT | Barcha bildirishnomalar |
| GET | `/notifications/:id` | JWT | Bitta bildirishnoma |
| POST | `/notifications` | JWT | Bildirishnoma yaratish |
| PUT | `/notifications/:id` | JWT | Yangilash |
| DELETE | `/notifications/:id` | JWT | O'chirish |

---

### Fayl yuklash `/api/upload`

| Method | Endpoint | Auth | Tavsif |
|--------|----------|------|--------|
| POST | `/upload` | JWT | Fayl yuklash (MinIO) |

**Query Params:**
- `is_face_image` (boolean, default: false) — profil rasm bo'lsa true, max 50KB

**Request:** `multipart/form-data`, `file` maydoni

**Qo'llab-quvvatlanadigan formatlar:**
- Rasmlar: jpeg, png, jpg, webp, gif, svg, tiff, bmp
- Video: mp4, webm, mov
- Hujjatlar: PDF, DOCX

**Response:**
```json
{ "fileUrl": "hashed_filename.ext" }
```

---

## Autentifikatsiya mexanizmi

**Tur:** Bearer Token (JWT)

**Token olish:** `POST /api/auth/login` orqali

**So'rovlarda ishlatish:**
```
Authorization: Bearer <token>
```

**Token tarkibi:**
```json
{ "sub": "<user_id>", "role": "<role_id>" }
```

**Himoya:**
- `JwtAuthGuard` — tokenni tekshiradi
- `RolesGuard` — foydalanuvchi rolini tekshiradi
- Barcha `/api/*` endpointlar (login va change-password dan tashqari) JWT talab qiladi

---

## Sahifalash (Pagination)

Barcha ro'yxat endpointlari quyidagi response formatini qaytaradi:

```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "pageCount": 10
  }
}
```

**Query parametrlar:**
| Param | Default | Max | Tavsif |
|-------|---------|-----|--------|
| page | 1 | — | Sahifa raqami |
| pageSize | 10 | 100 | Sahifadagi elementlar soni |
| search | — | — | Qidiruv matni |
| sortBy | — | — | ASC yoki DESC |

---

## Xato kodlari

| Kod | Ma'no |
|-----|-------|
| 400 | Bad Request — noto'g'ri ma'lumot |
| 401 | Unauthorized — token yo'q yoki noto'g'ri |
| 403 | Forbidden — ruxsat yo'q |
| 404 | Not Found — resurs topilmadi |
| 500 | Internal Server Error |

---

## Muhit o'zgaruvchilari (`.env`)

```env
DATABASE_URL=postgresql://postgres:root@localhost:5433/itech_quiz_databases
JWT_SECRET=<256 bit hex string>
MINIO_ENDPOINT=<host>
MINIO_PORT=<port>
MINIO_ACCESS_KEY=<key>
MINIO_SECRET_KEY=<secret>
MINIO_BUCKET=<bucket-name>
MINIO_USE_SSL=false
PORT=4000
TZ=Asia/Tashkent
ADMIN_USERNAME=<username>
ADMIN_PHONE=<phone>
```

---

## Ishga tushirish

### Development
```bash
npm install
npm run prisma:gen
npm run prisma:deploy
npm run dev
```

### Production
```bash
npm install
npm run build
npm run start:prod
```

### Docker
```bash
docker-compose up -d
```

**Manzillar:**
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/swagger`
- MinIO Console: `http://localhost:9001`

---

## Konstantalar

### RolesEnum
```typescript
ADMIN       = 'ADMIN'
SUPER_ADMIN = 'SUPER_ADMIN'
```

### UserStatus
```typescript
ACTIVE  = 'ACTIVE'
DELETED = 'DELETED'
```

### Telefon raqam regex (O'zbekiston)
```
/^(?:\+998 ?)?\d{2} ?\d{3} ?\d{2} ?\d{2}$/
```

### Ruxsatlar ro'yxati
```
read, create, update, remove, view, filter,
export, import, upload, print, share, restore
```

---

## Barcha API endpointlar (qisqa ro'yxat)

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/auth/login | — |
| POST | /api/auth/change-password | — |
| GET | /api/users | JWT |
| GET | /api/users/me | JWT |
| GET | /api/users/number-of-users | JWT |
| GET | /api/users/:id | JWT |
| POST | /api/users | JWT |
| PUT | /api/users/:id | JWT |
| PATCH | /api/users/:branchId | JWT |
| DELETE | /api/users/:id | JWT |
| GET | /api/branch | JWT |
| GET | /api/branch/:id | JWT |
| POST | /api/branch | JWT |
| PUT | /api/branch/:id | JWT |
| DELETE | /api/branch/:id | JWT |
| GET | /api/roles | JWT |
| GET | /api/roles/some | JWT |
| GET | /api/roles/:id | JWT |
| POST | /api/roles | JWT |
| DELETE | /api/roles/:id | JWT |
| GET | /api/patients | JWT |
| GET | /api/patients/:id | JWT |
| POST | /api/patients | JWT |
| PUT | /api/patients/:id | JWT |
| DELETE | /api/patients/:id | JWT |
| GET | /api/notifications | JWT |
| GET | /api/notifications/:id | JWT |
| POST | /api/notifications | JWT |
| PUT | /api/notifications/:id | JWT |
| DELETE | /api/notifications/:id | JWT |
| POST | /api/upload | JWT |
