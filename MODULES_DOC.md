# Zahro Dental — Modullar Dokumentatsiyasi

> Ushbu hujjat loyihaning yangi modullariga oid **DB modellari**, **Controller endpointlari** va **Service metodlari** ni o'z ichiga oladi.

---

## 1. Foydalanuvchi Rollari (User Roles)

| Rol | Enum nomi | Tavsif |
|-----|-----------|--------|
| Super Admin | `SUPER_ADMIN` | Tizimga to'liq kirish, rollar va ruxsatlarni boshqarish |
| Admin | `ADMIN` | Mijoz, bron, to'lov, SMS, so'rovlarni boshqarish |
| Doctor | `DOCTOR` | Bemorlar, tibbiy tarix, holat va jadval boshqaruvi |
| Client | `CLIENT` | Qabulga yozilish, bildirishnomalar, lokatsiya ko'rish |

### Rol bo'yicha ruxsatlar

#### SUPER_ADMIN
- Barcha modullar: to'liq CRUD
- Rollar va Permission boshqaruvi
- Tizim sozlamalari, analitika, filial boshqaruvi
- Barcha foydalanuvchilarni ko'rish va boshqarish

#### ADMIN
- Bemorlar: qo'shish, tahrirlash, ko'rish
- Bronlar: yaratish, tasdiqlash, bekor qilish
- To'lovlar: kiritish, ko'rish
- Manba kuzatuvi
- SMS yuborish
- Web / Telegram so'rovlarini qabul qilish

#### DOCTOR
- O'z bemorlarini ko'rish
- Tibbiy tarix qo'shish va ko'rish
- Bemor holatini o'zgartirish
- O'z jadvalini ko'rish

#### CLIENT
- Qabulga yozilish (booking yaratish)
- Sana va vaqt tanlash
- Bildirishnomalar olish
- Klinika lokatsiyasini ko'rish

---

## 2. Ma'lumotlar Bazasi Modellari (Prisma Schema)

### 2.1 Patient (Bemor)

```prisma
model Patient {
  id          String        @id @default(cuid())
  firstName   String
  lastName    String?
  phone       String        @unique
  address     String?
  birthDate   DateTime?
  gender      Gender?
  source      PatientSource @default(ADMIN)
  notes       String?
  branchId    String?
  branch      Branch?       @relation(fields: [branchId], references: [id])
  bookings    Booking[]
  medicalRecs MedicalRecord[]
  payments    Payment[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@map("patients")
}

enum Gender {
  MALE
  FEMALE
}

enum PatientSource {
  INSTAGRAM
  RECOMMENDATION  // Tavsiya
  WALK_IN         // Bevosita kelgan
  WEB
  TELEGRAM
  ADMIN
}
```

---

### 2.2 Booking (Bron)

```prisma
model Booking {
  id          String        @id @default(cuid())
  patientId   String
  doctorId    String
  branchId    String
  serviceId   String?
  date        DateTime
  startTime   String        // "09:00"
  endTime     String?       // "09:30"
  status      BookingStatus @default(PENDING)
  source      BookingSource @default(ADMIN)
  notes       String?
  cancelReason String?

  patient     Patient       @relation(fields: [patientId], references: [id])
  doctor      User          @relation("DoctorBookings", fields: [doctorId], references: [id])
  branch      Branch        @relation(fields: [branchId], references: [id])
  service     Service?      @relation(fields: [serviceId], references: [id])
  payment     Payment?
  medicalRecord MedicalRecord?

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@map("bookings")
}

enum BookingStatus {
  PENDING     // Kutilmoqda
  CONFIRMED   // Tasdiqlandi
  CANCELLED   // Bekor qilindi
  COMPLETED   // Yakunlandi
  NO_SHOW     // Kelmadi
}

enum BookingSource {
  WEB
  BOT             // Telegram bot
  ADMIN           // Admin tomonidan
  INSTAGRAM
  RECOMMENDATION
  WALK_IN
}
```

---

### 2.3 DoctorSchedule (Shifokor jadvali)

```prisma
model DoctorSchedule {
  id          String   @id @default(cuid())
  doctorId    String
  branchId    String
  dayOfWeek   Int      // 0=Yakshanba, 1=Dushanba, ..., 6=Shanba
  startTime   String   // "08:00"
  endTime     String   // "18:00"
  isAvailable Boolean  @default(true)
  slotDuration Int     @default(30) // daqiqada, har bir qabul vaqti

  doctor      User     @relation("DoctorSchedules", fields: [doctorId], references: [id])
  branch      Branch   @relation(fields: [branchId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([doctorId, branchId, dayOfWeek])
  @@map("doctor_schedules")
}
```

---

### 2.4 MedicalRecord (Tibbiy yozuv)

```prisma
model MedicalRecord {
  id             String    @id @default(cuid())
  patientId      String
  doctorId       String
  bookingId      String?   @unique
  diagnosis      String
  treatmentNotes String?
  visitDate      DateTime
  attachments    String[]  // MinIO fayl nomlari (rasmlar, PDF)

  patient        Patient   @relation(fields: [patientId], references: [id])
  doctor         User      @relation("DoctorRecords", fields: [doctorId], references: [id])
  booking        Booking?  @relation(fields: [bookingId], references: [id])

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@map("medical_records")
}
```

---

### 2.5 Service (Xizmat / Narxlar)

```prisma
model Service {
  id          String    @id @default(cuid())
  name        String
  price       Decimal   @db.Decimal(10, 2)
  description String?
  duration    Int?      // daqiqada (qabul davomiyligi)
  isActive    Boolean   @default(true)
  branchId    String?
  branch      Branch?   @relation(fields: [branchId], references: [id])
  bookings    Booking[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("services")
}
```

---

### 2.6 Payment (To'lov)

```prisma
model Payment {
  id            String        @id @default(cuid())
  patientId     String
  bookingId     String?       @unique
  amount        Decimal       @db.Decimal(10, 2)
  discount      Decimal?      @db.Decimal(10, 2)
  totalAmount   Decimal       @db.Decimal(10, 2)
  paymentMethod PaymentMethod @default(CASH)
  status        PaymentStatus @default(PENDING)
  description   String?
  paidAt        DateTime?

  patient       Patient       @relation(fields: [patientId], references: [id])
  booking       Booking?      @relation(fields: [bookingId], references: [id])

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@map("payments")
}

enum PaymentMethod {
  CASH      // Naqd
  CARD      // Karta
  TRANSFER  // O'tkazma
}

enum PaymentStatus {
  PENDING   // Kutilmoqda
  PAID      // To'langan
  CANCELLED // Bekor qilindi
  REFUNDED  // Qaytarildi
}
```

---

### 2.7 Notification (Bildirishnoma — kengaytirilgan)

```prisma
model Notification {
  id          String             @id @default(cuid())
  type        NotificationType
  recipientId String             // User yoki Patient ID
  message     String
  status      NotificationStatus @default(PENDING)
  scheduledAt DateTime?
  sentAt      DateTime?
  metadata    Json?              // qo'shimcha ma'lumotlar

  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@map("notifications")
}

enum NotificationType {
  SMS
  TELEGRAM
  PUSH
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}
```

---

### Mavjud modellarni kengaytirish (User va Branch)

```prisma
// User modeliga qo'shiladi:
model User {
  // ... mavjud maydonlar ...
  bookings        Booking[]       @relation("DoctorBookings")
  schedules       DoctorSchedule[] @relation("DoctorSchedules")
  medicalRecords  MedicalRecord[] @relation("DoctorRecords")
}

// Branch modeliga qo'shiladi:
model Branch {
  // ... mavjud maydonlar ...
  bookings    Booking[]
  schedules   DoctorSchedule[]
  services    Service[]
  patients    Patient[]
}
```

---

## 3. Controller Endpointlari

### 3.1 Booking Controller — `/api/bookings`

| Method | Endpoint | Rol | Tavsif |
|--------|----------|-----|--------|
| GET | `/bookings` | ADMIN, SUPER_ADMIN | Barcha bronlar (filtr, sahifalash) |
| GET | `/bookings/calendar` | ADMIN, DOCTOR, SUPER_ADMIN | Kalendar ko'rinishida bronlar |
| GET | `/bookings/available-slots` | Hammasi | Bo'sh vaqt slotlarini olish |
| GET | `/bookings/:id` | ADMIN, DOCTOR, SUPER_ADMIN | Bitta bron |
| POST | `/bookings` | ADMIN, CLIENT, SUPER_ADMIN | Bron yaratish |
| PUT | `/bookings/:id` | ADMIN, SUPER_ADMIN | Bronni tahrirlash |
| PATCH | `/bookings/:id/confirm` | ADMIN, SUPER_ADMIN | Bronni tasdiqlash |
| PATCH | `/bookings/:id/cancel` | ADMIN, SUPER_ADMIN, CLIENT | Bronni bekor qilish |
| PATCH | `/bookings/:id/complete` | DOCTOR, ADMIN, SUPER_ADMIN | Bronni yakunlash |
| DELETE | `/bookings/:id` | SUPER_ADMIN | Bronni o'chirish |

**POST /bookings — Request Body**
```json
{
  "patientId": "cuid...",
  "doctorId": "cuid...",
  "branchId": "cuid...",
  "serviceId": "cuid...",
  "date": "2025-06-15",
  "startTime": "10:00",
  "source": "ADMIN",
  "notes": "Tish og'rig'i"
}
```

**GET /bookings — Query Params**
```
page, pageSize, search
doctorId      (CUID)
patientId     (CUID)
branchId      (CUID)
status        (PENDING | CONFIRMED | CANCELLED | COMPLETED)
source        (WEB | BOT | ADMIN | INSTAGRAM | RECOMMENDATION | WALK_IN)
dateFrom      (ISO date)
dateTo        (ISO date)
sortBy        (ASC | DESC)
```

**GET /bookings/available-slots — Query Params**
```
doctorId   (required, CUID)
branchId   (required, CUID)
date       (required, ISO date, e.g. "2025-06-15")
```

**Response (available-slots):**
```json
{
  "date": "2025-06-15",
  "doctorId": "cuid...",
  "slots": [
    { "time": "09:00", "available": true },
    { "time": "09:30", "available": false },
    { "time": "10:00", "available": true }
  ]
}
```

---

### 3.2 Patient Controller — `/api/patients`

| Method | Endpoint | Rol | Tavsif |
|--------|----------|-----|--------|
| GET | `/patients` | ADMIN, DOCTOR, SUPER_ADMIN | Barcha bemorlar |
| GET | `/patients/:id` | ADMIN, DOCTOR, SUPER_ADMIN | Bitta bemor |
| GET | `/patients/:id/bookings` | ADMIN, DOCTOR, SUPER_ADMIN | Bemor bronlari tarixi |
| GET | `/patients/:id/medical-records` | ADMIN, DOCTOR, SUPER_ADMIN | Bemor tibbiy tarixi |
| GET | `/patients/:id/payments` | ADMIN, SUPER_ADMIN | Bemor to'lovlari |
| POST | `/patients` | ADMIN, SUPER_ADMIN | Bemor qo'shish |
| PUT | `/patients/:id` | ADMIN, SUPER_ADMIN | Bemorni tahrirlash |
| DELETE | `/patients/:id` | SUPER_ADMIN | Bemorni o'chirish |

**POST /patients — Request Body**
```json
{
  "firstName": "Nodira",
  "lastName": "Karimova",
  "phone": "+998901234567",
  "address": "Yunusobod tumani",
  "birthDate": "1990-05-20",
  "gender": "FEMALE",
  "source": "INSTAGRAM",
  "notes": "Birinchi tashrif",
  "branchId": "cuid..."
}
```

**GET /patients — Query Params**
```
page, pageSize, search, sortBy
source    (PatientSource)
gender    (MALE | FEMALE)
branchId  (CUID)
dateFrom, dateTo  (yaratilgan sana oralig'i)
```

---

### 3.3 Doctor Controller — `/api/doctors`

| Method | Endpoint | Rol | Tavsif |
|--------|----------|-----|--------|
| GET | `/doctors` | ADMIN, SUPER_ADMIN | Barcha shifokorlar |
| GET | `/doctors/:id` | ADMIN, SUPER_ADMIN | Bitta shifokor |
| GET | `/doctors/:id/schedule` | Hammasi | Shifokor jadvali |
| GET | `/doctors/:id/patients` | ADMIN, DOCTOR, SUPER_ADMIN | Biriktirilgan bemorlar |
| GET | `/doctors/:id/bookings` | ADMIN, DOCTOR, SUPER_ADMIN | Shifokor bronlari |
| POST | `/doctors/:id/schedule` | ADMIN, SUPER_ADMIN | Jadval qo'shish/yangilash |
| PUT | `/doctors/:id/schedule/:scheduleId` | ADMIN, SUPER_ADMIN | Jadval o'zgartirish |
| DELETE | `/doctors/:id/schedule/:scheduleId` | ADMIN, SUPER_ADMIN | Jadval o'chirish |

> Shifokorlar — `DOCTOR` roliga ega `User` modeli yozuvlari.  
> Yangi shifokor qo'shish uchun `POST /api/users` endpointi ishlatiladi (`roleId` = DOCTOR roli ID).

**POST /doctors/:id/schedule — Request Body**
```json
{
  "branchId": "cuid...",
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "18:00",
  "slotDuration": 30,
  "isAvailable": true
}
```

---

### 3.4 Medical Records Controller — `/api/medical-records`

| Method | Endpoint | Rol | Tavsif |
|--------|----------|-----|--------|
| GET | `/medical-records` | ADMIN, DOCTOR, SUPER_ADMIN | Barcha tibbiy yozuvlar |
| GET | `/medical-records/:id` | ADMIN, DOCTOR, SUPER_ADMIN | Bitta yozuv |
| POST | `/medical-records` | DOCTOR, ADMIN, SUPER_ADMIN | Tibbiy yozuv qo'shish |
| PUT | `/medical-records/:id` | DOCTOR, SUPER_ADMIN | Yozuvni tahrirlash |
| DELETE | `/medical-records/:id` | SUPER_ADMIN | Yozuvni o'chirish |

**POST /medical-records — Request Body**
```json
{
  "patientId": "cuid...",
  "doctorId": "cuid...",
  "bookingId": "cuid...",
  "diagnosis": "Tish kariesi (K02.1)",
  "treatmentNotes": "Plomba qo'yildi, dorilar tavsiya qilindi",
  "visitDate": "2025-06-15T10:00:00",
  "attachments": ["xray_image.jpg", "prescription.pdf"]
}
```

**GET /medical-records — Query Params**
```
page, pageSize, sortBy
patientId   (CUID)
doctorId    (CUID)
dateFrom, dateTo
```

---

### 3.5 Service Controller — `/api/services`

| Method | Endpoint | Rol | Tavsif |
|--------|----------|-----|--------|
| GET | `/services` | Hammasi | Barcha xizmatlar va narxlar |
| GET | `/services/:id` | Hammasi | Bitta xizmat |
| POST | `/services` | ADMIN, SUPER_ADMIN | Xizmat qo'shish |
| PUT | `/services/:id` | ADMIN, SUPER_ADMIN | Xizmatni yangilash |
| DELETE | `/services/:id` | SUPER_ADMIN | Xizmatni o'chirish |

**POST /services — Request Body**
```json
{
  "name": "Tish oqartirish",
  "price": 350000,
  "description": "Professional bleaching",
  "duration": 60,
  "branchId": "cuid..."
}
```

---

### 3.6 Payment Controller — `/api/payments`

| Method | Endpoint | Rol | Tavsif |
|--------|----------|-----|--------|
| GET | `/payments` | ADMIN, SUPER_ADMIN | Barcha to'lovlar |
| GET | `/payments/:id` | ADMIN, SUPER_ADMIN | Bitta to'lov |
| GET | `/payments/stats` | ADMIN, SUPER_ADMIN | To'lov statistikasi |
| POST | `/payments` | ADMIN, SUPER_ADMIN | To'lov kiritish |
| PUT | `/payments/:id` | ADMIN, SUPER_ADMIN | To'lovni yangilash |
| PATCH | `/payments/:id/confirm` | ADMIN, SUPER_ADMIN | To'lovni tasdiqlash |
| DELETE | `/payments/:id` | SUPER_ADMIN | To'lovni o'chirish |

**POST /payments — Request Body**
```json
{
  "patientId": "cuid...",
  "bookingId": "cuid...",
  "amount": 350000,
  "discount": 50000,
  "totalAmount": 300000,
  "paymentMethod": "CASH",
  "description": "Tish oqartirish xizmati"
}
```

**GET /payments — Query Params**
```
page, pageSize, sortBy
patientId     (CUID)
bookingId     (CUID)
status        (PENDING | PAID | CANCELLED | REFUNDED)
paymentMethod (CASH | CARD | TRANSFER)
dateFrom, dateTo
```

**GET /payments/stats — Response**
```json
{
  "totalRevenue": 12500000,
  "totalPaid": 11000000,
  "totalPending": 1500000,
  "byMethod": {
    "CASH": 8000000,
    "CARD": 3000000,
    "TRANSFER": 500000
  },
  "period": { "from": "2025-06-01", "to": "2025-06-30" }
}
```

---

### 3.7 Notification Controller — `/api/notifications`

| Method | Endpoint | Rol | Tavsif |
|--------|----------|-----|--------|
| GET | `/notifications` | ADMIN, SUPER_ADMIN | Barcha bildirishnomalar |
| GET | `/notifications/:id` | ADMIN, SUPER_ADMIN | Bitta bildirishnoma |
| POST | `/notifications` | ADMIN, SUPER_ADMIN | Bildirishnoma yuborish |
| POST | `/notifications/bulk` | ADMIN, SUPER_ADMIN | Ommaviy SMS/Telegram yuborish |
| POST | `/notifications/reminder` | ADMIN, SUPER_ADMIN | Bron eslatmasi yuborish |
| PUT | `/notifications/:id` | SUPER_ADMIN | Yangilash |
| DELETE | `/notifications/:id` | SUPER_ADMIN | O'chirish |

**POST /notifications — Request Body**
```json
{
  "type": "SMS",
  "recipientId": "cuid...",
  "message": "Qabul eslatmasi: 15-iyun soat 10:00",
  "scheduledAt": "2025-06-14T18:00:00"
}
```

**POST /notifications/reminder — Request Body**
```json
{
  "bookingId": "cuid...",
  "hoursBeforeAppointment": 24
}
```

---

## 4. Service Metodlari

### 4.1 BookingService

```typescript
// Bronlar ro'yxati (filter, sahifalash)
findAll(pagination: BookingFilterDto, user: IUser): Promise<PaginatedResult<Booking>>

// Bitta bron
findOne(id: string): Promise<Booking>

// Bron yaratish
create(data: CreateBookingDto, user: IUser): Promise<Booking>

// Bronni tahrirlash
update(id: string, data: UpdateBookingDto): Promise<Booking>

// Bronni tasdiqlash (status: CONFIRMED)
confirm(id: string, user: IUser): Promise<Booking>

// Bronni bekor qilish (status: CANCELLED)
cancel(id: string, reason: string, user: IUser): Promise<Booking>

// Bronni yakunlash (status: COMPLETED)
complete(id: string, user: IUser): Promise<Booking>

// Shifokorning bo'sh vaqt slotlarini hisoblash
getAvailableSlots(doctorId: string, branchId: string, date: string): Promise<TimeSlot[]>

// Kalendar ko'rinishi (kun/hafta/oy)
getCalendar(filter: CalendarFilterDto): Promise<BookingCalendar>

// Bronni o'chirish
remove(id: string): Promise<void>
```

---

### 4.2 PatientService

```typescript
// Bemorlar ro'yxati
findAll(pagination: PatientFilterDto): Promise<PaginatedResult<Patient>>

// Bitta bemor
findOne(id: string): Promise<Patient>

// Bemor bronlari tarixi
findPatientBookings(patientId: string, pagination: PaginationDto): Promise<PaginatedResult<Booking>>

// Bemor tibbiy tarixi
findPatientMedicalRecords(patientId: string, pagination: PaginationDto): Promise<PaginatedResult<MedicalRecord>>

// Bemor to'lovlari
findPatientPayments(patientId: string, pagination: PaginationDto): Promise<PaginatedResult<Payment>>

// Bemor qo'shish
create(data: CreatePatientDto): Promise<Patient>

// Bemorni yangilash
update(id: string, data: UpdatePatientDto): Promise<Patient>

// Bemorni o'chirish
remove(id: string): Promise<void>
```

---

### 4.3 DoctorService

```typescript
// Shifokorlar ro'yxati (DOCTOR roliga ega foydalanuvchilar)
findAll(pagination: PaginationDto): Promise<PaginatedResult<User>>

// Bitta shifokor
findOne(id: string): Promise<User>

// Shifokor jadvali
getSchedule(doctorId: string, branchId?: string): Promise<DoctorSchedule[]>

// Shifokorning bemorlarini olish
getAssignedPatients(doctorId: string, pagination: PaginationDto): Promise<PaginatedResult<Patient>>

// Shifokorning bronlarini olish
getDoctorBookings(doctorId: string, filter: BookingFilterDto): Promise<PaginatedResult<Booking>>

// Jadval qo'shish yoki yangilash (upsert)
upsertSchedule(doctorId: string, data: CreateScheduleDto): Promise<DoctorSchedule>

// Jadval o'chirish
removeSchedule(scheduleId: string): Promise<void>
```

---

### 4.4 MedicalRecordService

```typescript
// Tibbiy yozuvlar ro'yxati
findAll(pagination: MedicalRecordFilterDto): Promise<PaginatedResult<MedicalRecord>>

// Bitta yozuv
findOne(id: string): Promise<MedicalRecord>

// Yozuv yaratish
create(data: CreateMedicalRecordDto, doctor: IUser): Promise<MedicalRecord>

// Yozuvni yangilash
update(id: string, data: UpdateMedicalRecordDto, doctor: IUser): Promise<MedicalRecord>

// Yozuvni o'chirish
remove(id: string): Promise<void>
```

---

### 4.5 ServiceService (Xizmatlar)

```typescript
// Xizmatlar ro'yxati
findAll(pagination: PaginationDto): Promise<PaginatedResult<Service>>

// Bitta xizmat
findOne(id: string): Promise<Service>

// Xizmat qo'shish
create(data: CreateServiceDto): Promise<Service>

// Xizmatni yangilash
update(id: string, data: UpdateServiceDto): Promise<Service>

// Xizmatni faolsizlashtirish
deactivate(id: string): Promise<Service>

// Xizmatni o'chirish
remove(id: string): Promise<void>
```

---

### 4.6 PaymentService

```typescript
// To'lovlar ro'yxati
findAll(pagination: PaymentFilterDto): Promise<PaginatedResult<Payment>>

// Bitta to'lov
findOne(id: string): Promise<Payment>

// To'lov statistikasi
getStats(dateFrom: string, dateTo: string, branchId?: string): Promise<PaymentStats>

// To'lov kiritish
create(data: CreatePaymentDto, user: IUser): Promise<Payment>

// To'lovni yangilash
update(id: string, data: UpdatePaymentDto): Promise<Payment>

// To'lovni tasdiqlash (status: PAID, paidAt = now)
confirm(id: string): Promise<Payment>

// To'lovni bekor qilish
cancel(id: string): Promise<Payment>

// To'lovni o'chirish
remove(id: string): Promise<void>
```

---

### 4.7 NotificationService

```typescript
// Bildirishnomalar ro'yxati
findAll(pagination: NotificationFilterDto): Promise<PaginatedResult<Notification>>

// Bitta bildirishnoma
findOne(id: string): Promise<Notification>

// Bildirishnoma yuborish (SMS yoki Telegram)
send(data: CreateNotificationDto): Promise<Notification>

// Ommaviy yuborish (filter bo'yicha bemorlar/foydalanuvchilarga)
sendBulk(recipientIds: string[], message: string, type: NotificationType): Promise<void>

// Bron eslatmasini avtomatik yuborish
sendBookingReminder(bookingId: string, hoursBeforeAppointment: number): Promise<void>

// SMS integratsiya orqali yuborish
sendSms(phone: string, message: string): Promise<boolean>

// Telegram orqali yuborish
sendTelegram(chatId: string, message: string): Promise<boolean>

// Bildirishnomani yangilash
update(id: string, data: UpdateNotificationDto): Promise<Notification>

// Bildirishnomani o'chirish
remove(id: string): Promise<void>
```

---

## 5. DTO Tuzilmalari

### CreateBookingDto
```typescript
patientId     string (CUID, required)
doctorId      string (CUID, required)
branchId      string (CUID, required)
serviceId     string (CUID, optional)
date          string (ISO date, required)   // "2025-06-15"
startTime     string (required)             // "10:00"
source        BookingSource (required)
notes         string (optional)
```

### CreatePatientDto
```typescript
firstName     string (required)
lastName      string (optional)
phone         string (required, unique, UZ format)
address       string (optional)
birthDate     string (optional, ISO date)
gender        Gender (optional)
source        PatientSource (required)
notes         string (optional)
branchId      string (CUID, optional)
```

### CreateScheduleDto
```typescript
branchId      string (CUID, required)
dayOfWeek     number (0–6, required)
startTime     string (required)   // "08:00"
endTime       string (required)   // "18:00"
slotDuration  number (default: 30)
isAvailable   boolean (default: true)
```

### CreateMedicalRecordDto
```typescript
patientId      string (CUID, required)
doctorId       string (CUID, required)
bookingId      string (CUID, optional)
diagnosis      string (required)
treatmentNotes string (optional)
visitDate      string (ISO datetime, required)
attachments    string[] (optional)
```

### CreateServiceDto
```typescript
name        string  (required)
price       number  (required, positive)
description string  (optional)
duration    number  (optional, minutes)
branchId    string  (CUID, optional)
```

### CreatePaymentDto
```typescript
patientId     string        (CUID, required)
bookingId     string        (CUID, optional)
amount        number        (required, positive)
discount      number        (optional)
totalAmount   number        (required)
paymentMethod PaymentMethod (required)
description   string        (optional)
```

### CreateNotificationDto
```typescript
type          NotificationType (required)
recipientId   string           (CUID, required)
message       string           (required)
scheduledAt   string           (optional, ISO datetime)
```

---

## 6. Enum to'plami (barcha yangi enumlar)

```typescript
// Foydalanuvchi rollari
enum RolesEnum {
  SUPER_ADMIN = 'SUPER_ADMIN'
  ADMIN       = 'ADMIN'
  DOCTOR      = 'DOCTOR'
  CLIENT      = 'CLIENT'
}

// Bemor jinsi
enum Gender {
  MALE   = 'MALE'
  FEMALE = 'FEMALE'
}

// Bemor / Bron manbai
enum PatientSource / BookingSource {
  INSTAGRAM      = 'INSTAGRAM'
  RECOMMENDATION = 'RECOMMENDATION'
  WALK_IN        = 'WALK_IN'
  WEB            = 'WEB'
  BOT            = 'BOT'
  ADMIN          = 'ADMIN'
}

// Bron holati
enum BookingStatus {
  PENDING   = 'PENDING'
  CONFIRMED = 'CONFIRMED'
  CANCELLED = 'CANCELLED'
  COMPLETED = 'COMPLETED'
  NO_SHOW   = 'NO_SHOW'
}

// To'lov usuli
enum PaymentMethod {
  CASH     = 'CASH'
  CARD     = 'CARD'
  TRANSFER = 'TRANSFER'
}

// To'lov holati
enum PaymentStatus {
  PENDING   = 'PENDING'
  PAID      = 'PAID'
  CANCELLED = 'CANCELLED'
  REFUNDED  = 'REFUNDED'
}

// Bildirishnoma turi
enum NotificationType {
  SMS      = 'SMS'
  TELEGRAM = 'TELEGRAM'
  PUSH     = 'PUSH'
}

// Bildirishnoma holati
enum NotificationStatus {
  PENDING   = 'PENDING'
  SENT      = 'SENT'
  FAILED    = 'FAILED'
  CANCELLED = 'CANCELLED'
}
```

---

## 7. Modular fayl tuzilmasi (yangi modullar)

```
src/api/
├── booking/
│   ├── booking.controller.ts
│   ├── booking.service.ts
│   ├── booking.module.ts
│   └── dto/
│       ├── create-booking.dto.ts
│       ├── update-booking.dto.ts
│       └── filter-booking.dto.ts
├── patient/                      # mavjud, kengaytiriladi
│   ├── patient.controller.ts
│   ├── patient.service.ts
│   ├── patient.module.ts
│   └── dto/
│       ├── create-patient.dto.ts
│       ├── update-patient.dto.ts
│       └── filter-patient.dto.ts
├── doctor/
│   ├── doctor.controller.ts
│   ├── doctor.service.ts
│   ├── doctor.module.ts
│   └── dto/
│       ├── create-schedule.dto.ts
│       └── update-schedule.dto.ts
├── medical-record/
│   ├── medical-record.controller.ts
│   ├── medical-record.service.ts
│   ├── medical-record.module.ts
│   └── dto/
│       ├── create-medical-record.dto.ts
│       └── filter-medical-record.dto.ts
├── service/                      # Xizmatlar va narxlar
│   ├── service.controller.ts
│   ├── service.service.ts
│   ├── service.module.ts
│   └── dto/
│       ├── create-service.dto.ts
│       └── update-service.dto.ts
├── payment/
│   ├── payment.controller.ts
│   ├── payment.service.ts
│   ├── payment.module.ts
│   └── dto/
│       ├── create-payment.dto.ts
│       ├── update-payment.dto.ts
│       └── filter-payment.dto.ts
└── notifications/                # mavjud, kengaytiriladi
    ├── notifications.controller.ts
    ├── notifications.service.ts
    ├── notifications.module.ts
    └── dto/
        ├── create-notification.dto.ts
        └── bulk-notification.dto.ts
```

---

## 8. Barcha yangi API endpointlar — qisqa ro'yxat

| Method | Endpoint | Auth | Rol |
|--------|----------|------|-----|
| GET | /api/bookings | JWT | ADMIN, SUPER_ADMIN |
| GET | /api/bookings/calendar | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| GET | /api/bookings/available-slots | JWT | Hammasi |
| GET | /api/bookings/:id | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| POST | /api/bookings | JWT | ADMIN, CLIENT, SUPER_ADMIN |
| PUT | /api/bookings/:id | JWT | ADMIN, SUPER_ADMIN |
| PATCH | /api/bookings/:id/confirm | JWT | ADMIN, SUPER_ADMIN |
| PATCH | /api/bookings/:id/cancel | JWT | ADMIN, SUPER_ADMIN, CLIENT |
| PATCH | /api/bookings/:id/complete | JWT | DOCTOR, ADMIN |
| DELETE | /api/bookings/:id | JWT | SUPER_ADMIN |
| GET | /api/patients | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| GET | /api/patients/:id | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| GET | /api/patients/:id/bookings | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| GET | /api/patients/:id/medical-records | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| GET | /api/patients/:id/payments | JWT | ADMIN, SUPER_ADMIN |
| POST | /api/patients | JWT | ADMIN, SUPER_ADMIN |
| PUT | /api/patients/:id | JWT | ADMIN, SUPER_ADMIN |
| DELETE | /api/patients/:id | JWT | SUPER_ADMIN |
| GET | /api/doctors | JWT | ADMIN, SUPER_ADMIN |
| GET | /api/doctors/:id | JWT | ADMIN, SUPER_ADMIN |
| GET | /api/doctors/:id/schedule | JWT | Hammasi |
| GET | /api/doctors/:id/patients | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| GET | /api/doctors/:id/bookings | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| POST | /api/doctors/:id/schedule | JWT | ADMIN, SUPER_ADMIN |
| PUT | /api/doctors/:id/schedule/:sid | JWT | ADMIN, SUPER_ADMIN |
| DELETE | /api/doctors/:id/schedule/:sid | JWT | ADMIN, SUPER_ADMIN |
| GET | /api/medical-records | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| GET | /api/medical-records/:id | JWT | ADMIN, DOCTOR, SUPER_ADMIN |
| POST | /api/medical-records | JWT | DOCTOR, ADMIN, SUPER_ADMIN |
| PUT | /api/medical-records/:id | JWT | DOCTOR, SUPER_ADMIN |
| DELETE | /api/medical-records/:id | JWT | SUPER_ADMIN |
| GET | /api/services | JWT | Hammasi |
| GET | /api/services/:id | JWT | Hammasi |
| POST | /api/services | JWT | ADMIN, SUPER_ADMIN |
| PUT | /api/services/:id | JWT | ADMIN, SUPER_ADMIN |
| DELETE | /api/services/:id | JWT | SUPER_ADMIN |
| GET | /api/payments | JWT | ADMIN, SUPER_ADMIN |
| GET | /api/payments/stats | JWT | ADMIN, SUPER_ADMIN |
| GET | /api/payments/:id | JWT | ADMIN, SUPER_ADMIN |
| POST | /api/payments | JWT | ADMIN, SUPER_ADMIN |
| PUT | /api/payments/:id | JWT | ADMIN, SUPER_ADMIN |
| PATCH | /api/payments/:id/confirm | JWT | ADMIN, SUPER_ADMIN |
| DELETE | /api/payments/:id | JWT | SUPER_ADMIN |
| GET | /api/notifications | JWT | ADMIN, SUPER_ADMIN |
| GET | /api/notifications/:id | JWT | ADMIN, SUPER_ADMIN |
| POST | /api/notifications | JWT | ADMIN, SUPER_ADMIN |
| POST | /api/notifications/bulk | JWT | ADMIN, SUPER_ADMIN |
| POST | /api/notifications/reminder | JWT | ADMIN, SUPER_ADMIN |
| DELETE | /api/notifications/:id | JWT | SUPER_ADMIN |
