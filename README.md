# Zahro Dental — Backend API

Zahro Dental stomatologiya klinikasi boshqaruv tizimining backend qismi: bemorlar, shifokorlar, qabullar (bookings),
tashriflar (visits), xizmatlar katalogi, to'lovlar, murojaatlar (lidlar), SMS/Telegram eslatmalar, dashboard
analitikasi va xodimlar boshqaruvi. Admin panel (`zahrodent_admin`) shu API ning mijozi.

- API hujjati (endpointlar, so'rov/javob shakllari): [docs/API.md](docs/API.md)
- Serverga o'rnatish, nginx, SSL, backup: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Test strategiyasi: [docs/TESTING.md](docs/TESTING.md)
- Interaktiv hujjat: `/swagger` (development'da standart yoqilgan, production'da `SWAGGER_ENABLED=true` bilan)

---

## Mundarija

1. [Imkoniyatlar](#imkoniyatlar)
2. [Texnologiyalar](#texnologiyalar)
3. [Arxitektura](#arxitektura)
4. [Talablar](#talablar)
5. [Lokal ishga tushirish](#lokal-ishga-tushirish)
6. [npm skriptlar](#npm-skriptlar)
7. [Muhit o'zgaruvchilari](#muhit-ozgaruvchilari)
8. [Ma'lumotlar bazasi va migratsiyalar](#malumotlar-bazasi-va-migratsiyalar)
9. [Rollar va ruxsatlar](#rollar-va-ruxsatlar)
10. [Autentifikatsiya (access / refresh)](#autentifikatsiya-access--refresh)
11. [Telegram bot va Eskiz SMS](#telegram-bot-va-eskiz-sms)
12. [Docker va CI/CD](#docker-va-cicd)
13. [Health check](#health-check)
14. [Loglar](#loglar)
15. [Backup va restore](#backup-va-restore)
16. [Muammolarni hal qilish](#muammolarni-hal-qilish)
17. [Xavfsizlik checklist](#xavfsizlik-checklist)

---

## Imkoniyatlar

- **Bemorlar** — karta, tish xaritasi (`toothChart`), izohlar, balans/qarz hisobi, biriktirilgan shifokor,
  **soft delete** (o'chirilgan bemor ro'yxatlardan yashiriladi, moliya tarixi saqlanadi) va tiklash.
- **Shifokorlar** — ish jadvali (`schedule`), dam olish kunlari, samaradorlik statistikasi; shifokor login hisobi
  bilan birga yaratiladi/o'chiriladi.
- **Qabullar** — vaqt to'qnashuvi nazorati (Postgres advisory lock), ish vaqtidan tashqari va o'tgan sanaga yozuv taqiqi.
- **Tashriflar va to'lovlar** — kirim (INCOME) va chiqim (EXPENSE) alohida, chegirmalar, qarzdorlar ro'yxati.
- **Lidlar** — Telegram bot orqali kelgan murojaatlar, status oqimi, admin/receptionistga real-time `newLead` hodisasi.
- **Eslatmalar** — Telegram botga ulangan bemorlarga bot orqali, qolganlarga Eskiz SMS; matn shablonlari va eslatma
  oynasi `/settings` da.
- **Analitika** — dashboard, oylik dinamika, manbalar bo'yicha taqsimot (pul ko'rsatkichlari faqat admin uchun).
- **Xavfsizlik** — rotatsiyalanadigan refresh tokenlar, RBAC, rate limiting, helmet, request id, strukturalangan loglar.

## Texnologiyalar

| Qatlam | Texnologiya |
|---|---|
| Runtime | Node.js 20 (Docker: `node:20-alpine`) |
| Framework | NestJS 10 (Express), `@nestjs/swagger`, `@nestjs/throttler`, `@nestjs/websockets` (Socket.IO) |
| ORM / DB | Prisma 5.22 (CLI va client bir xil versiya), PostgreSQL 14+ (compose'da 15) |
| Auth | `@nestjs/jwt` + `passport-jwt`, bcrypt, sha256-hash qilingan refresh tokenlar |
| Integratsiyalar | Telegraf 4 (Telegram bot, long polling), Eskiz.uz (SMS, `fetch`) |
| Test | Jest + ts-jest (unit), Supertest (e2e) |
| CI/CD | GitHub Actions → Docker Hub (`10449/zahrodent_backend`) → SSH deploy |

## Arxitektura

```
src/
├── main.ts                 bootstrap: logger, helmet, CORS, ValidationPipe, filter, throttler, Swagger
├── app.module.ts           barcha modullar
├── bootstrap/env-config.ts env tekshiruvlari (prod: JWT_SECRET, CORS_ORIGINS, INITIAL_ADMIN_PASSWORD)
├── common/                 guard'lar (JWT, Roles), dekoratorlar, DTO, filter, request-id middleware,
│                           logging (AppLogger, request context), sana/telefon util'lar
├── database/               PrismaService (global)
├── auth/                   login, refresh (rotation), logout, me, parol almashtirish, refresh token tozalash
├── users/                  xodimlar CRUD (admin), boshlang'ich adminni yaratish
├── patients/ doctors/ bookings/ visits/ services/ payments/ leads/ analytics/
├── notifications/          eslatmalar, ommaviy SMS, Eskiz klienti, Socket.IO gateway
├── settings/               klinika sozlamalari (bitta qator), eslatma shablonlari
├── telegram/               lead bot (Telegraf) + TelegramBotRegistry (eslatma yuborish uchun)
└── health/                 /health, /health/deps
prisma/
├── schema.prisma
├── migrations/             faqat oldinga (forward-only) migratsiyalar
└── seed.ts                 FAQAT lokal/dev uchun (hamma jadvallarni tozalaydi)
scripts/backup-db.sh        pg_dump backup + rotatsiya
```

Har bir modul `controller → service → repository (Prisma)` tartibida. Muhim jarayonlar:

- **Telegram bot** API jarayoni ichida long polling bilan ishlaydi (`TelegramService`). Token bo'lmasa yoki
  `TELEGRAM_BOT_ENABLED=false` bo'lsa bot o'chiq; eslatmalar SMS orqali ketadi.
- **Fon vazifalari** — `@nestjs/schedule` ishlatilmaydi. Refresh tokenlar tozalanishi kuniga bir marta oddiy taymer bilan
  (`RefreshTokensCleanupService`, har bir API jarayonida, idempotent). Eslatmalar avtomatik emas —
  `POST /notifications/send-reminders` orqali (admin panel yoki tashqi cron) ishga tushiriladi.
- **Socket.IO** — standart namespace, ulanishda JWT majburiy; `newLead` hodisasi faqat `admin` va `receptionist` ga.
- **Xatolar** — `AllExceptionsFilter`: `{ success:false, statusCode, message, path, timestamp, requestId }`, xabarlar
  o'zbekcha, 500 da ichki tafsilot faqat logda.

## Talablar

- Node.js **20.x** va npm 10+
- PostgreSQL **14+** (lokal, Docker yoki managed)
- (ixtiyoriy) Docker 24+ — image yig'ish / compose
- (ixtiyoriy) test uchun alohida Telegram bot tokeni, Eskiz hisobi

## Lokal ishga tushirish

```bash
# 1. Paketlar (lockfile bo'yicha)
npm ci

# 2. Muhit
cp .env.example .env
#    DATABASE_URL ni lokal Postgres'ga moslang

# 3. Baza: bo'sh DB yarating (masalan zahro_dental), so'ng migratsiyalar
npx prisma migrate deploy
npx prisma generate

# 4. (ixtiyoriy) bazani tozalab faqat admin qoldirish — DIQQAT: barcha jadvallarni tozalaydi
npm run prisma:seed

# 5. Dev server (watch)
npm run start:dev
# → http://localhost:3000, Swagger: http://localhost:3000/swagger
```

Birinchi ishga tushishda admin foydalanuvchi bo'lmasa, `INITIAL_ADMIN_PHONE` / `INITIAL_ADMIN_PASSWORD` bilan admin
yaratiladi. Docker bilan to'liq stek: `docker compose up -d --build` (Postgres `127.0.0.1:5432`, API `:7878`).

## npm skriptlar

| Skript | Vazifasi |
|---|---|
| `npm run start:dev` (`dev`) | Nest watch rejimi |
| `npm run start:debug` | Watch + inspector |
| `npm run build` | `dist/` ga build (`nest build`) |
| `npm run start:prod` | `node dist/src/main.js` |
| `npm test` | Unit testlar (DB kerak emas) |
| `npm run test:cov` | Unit + coverage (`coverage/`) |
| `npm run test:e2e` | E2E (haqiqiy DB kerak — production'da ishlatmang) |
| `npm run lint` | ESLint `--fix` (CI: `npx eslint src --max-warnings=0`) |
| `npm run format` | Prettier |
| `npm run prisma:generate` | Prisma client |
| `npm run prisma:migrate:deploy` | Migratsiyalarni qo'llash |
| `npm run prisma:migrate` | `prisma migrate dev` — **faqat o'z lokal bazangizda** yangi migratsiya yozish uchun |
| `npm run prisma:seed` | Bazani tozalab adminni qayta yaratish (production'da taqiqlangan) |

CI tekshiruvlari (PR va `main`): `npx tsc --noEmit -p tsconfig.json`, `npx eslint src --max-warnings=0`, `npx jest --ci --coverage`.

## Muhit o'zgaruvchilari

Namuna fayllar: [.env.example](.env.example) (dev) va [.env.production.example](.env.production.example) (production).

| O'zgaruvchi | Majburiy | Standart | Tavsif | Misol |
|---|---|---|---|---|
| `NODE_ENV` | prod'da ha | — | `production` qat'iy tekshiruvlarni yoqadi, Swagger'ni o'chiradi, JSON log | `production` |
| `PORT` | yo'q | `3000` (image'da `7878`) | Tinglash porti | `7878` |
| `HOST` | yo'q | `0.0.0.0` | Tinglash manzili | `0.0.0.0` |
| `TZ` | tavsiya | image'da `Asia/Tashkent` | Jarayon vaqt zonasi (sana mantiqi baribir Asia/Tashkent) | `Asia/Tashkent` |
| `DATABASE_URL` | **ha** | — | PostgreSQL ulanishi (Prisma) | `postgresql://zahro:***@zahro_db:5432/zahro_dental?schema=public` |
| `JWT_SECRET` | **ha** (prod) | dev: `dev-secret-change-me` | JWT imzo kaliti; prod'da ≥ 32 belgi, aks holda server ishga tushmaydi | `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | yo'q | `15m` | Access token muddati: `900`, `30s`, `15m`, `1h`, `7d` | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | yo'q | `30` | Refresh token muddati (kun, 1–365) | `30` |
| `CORS_ORIGINS` | **ha** (prod) | dev: hammasi | Ruxsat etilgan origin'lar (vergul bilan); Socket.IO ham | `https://admin.example.uz` |
| `PUBLIC_BASE_URL` | yo'q | `http://localhost:<PORT>` | Faqat start bannerida | `https://api.example.uz` |
| `TRUST_PROXY` | tavsiya | o'chiq | `1`/`true` — nginx ortida (haqiqiy IP rate limiting uchun) | `1` |
| `SWAGGER_ENABLED` | yo'q | dev: on, prod: off | `/swagger` UI | `false` |
| `LOG_FORMAT` | yo'q | prod: `json`, aks holda `text` | Log formati | `json` |
| `INITIAL_ADMIN_PHONE` | birinchi start | `+998901234567` | Admin yo'q bo'lsa yaratiladigan admin telefoni | `+998901234567` |
| `INITIAL_ADMIN_PASSWORD` | **ha** (prod) | dev: `admin123` | ≥ 8 belgi, `admin123` taqiqlangan (prod'da start to'xtaydi) | `openssl rand -base64 18` |
| `INITIAL_ADMIN_NAME` | yo'q | `Dr. Zahro Admin` | Admin ismi | `Admin` |
| `ESKIZ_EMAIL` | SMS uchun | — | Eskiz.uz login; bo'sh — SMS yuborilmaydi | `clinic@example.uz` |
| `ESKIZ_PASSWORD` | SMS uchun | — | Eskiz.uz parol/secret | `***` |
| `ESKIZ_FROM` | yo'q | `4546` | Jo'natuvchi (Eskiz kabinetida tasdiqlangan) | `4546` |
| `ESKIZ_BASE_URL` | yo'q | `https://notify.eskiz.uz` | Eskiz API manzili | — |
| `ESKIZ_HTTP_TIMEOUT_MS` | yo'q | `8000` | Eskiz HTTP timeout (ms) | `8000` |
| `TELEGRAM_BOT_TOKEN` | bot uchun | — | @BotFather tokeni; bo'sh — bot o'chiq | `123456:AA…` |
| `TELEGRAM_BOT_ENABLED` | yo'q | `true` | `false` — shu instansiyada polling qilmaslik | `true` |

Ro'yxat koddagi barcha `process.env.*` bilan solishtirilgan (`grep -rhoE "process\.env\.[A-Z_]+" src prisma`).

## Ma'lumotlar bazasi va migratsiyalar

Qoidalar:

1. **Faqat oldinga (forward-only).** Qo'llangan migratsiya fayli hech qachon tahrirlanmaydi yoki o'chirilmaydi —
   o'zgarish kerak bo'lsa yangi migratsiya yoziladi.
2. Umumiy/production bazada **hech qachon** `prisma migrate dev`, `prisma migrate reset` yoki `prisma db push` ishlatilmaydi.
3. Production'da migratsiyalar konteyner startida avtomatik: `prisma migrate deploy && node dist/src/main.js`.
4. Yangi migratsiya yozish (lokal):
   ```bash
   # schema.prisma ni o'zgartiring, so'ng vaqtinchalik shadow DB bilan SQL oling
   npx prisma db execute --url "postgresql://USER:PASS@localhost:5432/postgres" --stdin <<<'CREATE DATABASE zahro_shadow;'
   mkdir prisma/migrations/$(date +%Y%m%d%H%M%S)_nom
   npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
     --shadow-database-url "postgresql://USER:PASS@localhost:5432/zahro_shadow" --script > prisma/migrations/<papka>/migration.sql
   npx prisma migrate deploy
   npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script  # bo'sh bo'lishi kerak
   npx prisma db execute --url "postgresql://USER:PASS@localhost:5432/postgres" --stdin <<<'DROP DATABASE zahro_shadow;'
   ```
5. Holat: `npx prisma migrate status`.

Asosiy jadvallar: `users`, `refresh_tokens`, `patients` (`deleted_at`, `telegram_chat_id`), `doctors`, `services`,
`bookings`, `visits`, `payments`, `patient_comments`, `notifications`, `leads`, `clinic_settings` (bitta qator, `id = 1`).

## Rollar va ruxsatlar

Rollar: `admin`, `doctor`, `receptionist`. Ruxsat yo'q bo'lsa — **403** `Bu amal uchun ruxsat yo'q`.
Doctor faqat o'z bemorlari (biriktirilgan / qabul / tashrif orqali), o'z qabullari va tashriflarini ko'radi.

| Modul / marshrut | admin | receptionist | doctor |
|---|:-:|:-:|:-:|
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | ochiq | ochiq | ochiq |
| `GET /auth/me`, `PATCH /auth/password` | ✓ | ✓ | ✓ |
| `GET /patients`, `/patients/stats`, `/patients/:id`, izohlar, `PATCH /patients/:id` | ✓ | ✓ | ✓ (o'ziniki) |
| `POST /patients` | ✓ | ✓ | — |
| `DELETE /patients/:id`, `POST /patients/:id/restore`, `?includeDeleted=true` | ✓ | — | — |
| `GET /doctors`, `/doctors/:id` | ✓ | ✓ | ✓ |
| `POST/PATCH/DELETE /doctors`, `/doctors/stats`, `/doctors/efficiency` | ✓ | — | — |
| `GET /bookings`, `/bookings/stats`, `/bookings/:id` | ✓ | ✓ | ✓ (o'ziniki) |
| `POST/PATCH/DELETE /bookings` | ✓ | ✓ | — |
| `GET /visits`, `/visits/:id` | ✓ | ✓ | ✓ (o'ziniki) |
| `POST/PATCH /visits` | ✓ | — | ✓ (o'ziniki) |
| `GET /services`, `/services/:id` | ✓ | ✓ | ✓ |
| `GET /services/stats` | ✓ | ✓ | — |
| `POST/PATCH/DELETE /services` | ✓ | — | — |
| `/payments/*` | ✓ | — | — |
| `/leads/*` | ✓ | ✓ | — |
| `GET /notifications` | ✓ | ✓ | ✓ (o'ziga yuborilgan) |
| `POST /notifications`, `/send-reminders`, `/recipients`, `/bulk-send` | ✓ | ✓ | — |
| `/analytics/*` | ✓ | ✓ (pul maydonlari `null`) | ✓ (o'ziniki, pul `null`) |
| `GET /settings` | ✓ | ✓ | ✓ |
| `PATCH /settings` | ✓ | — | — |
| `/users/*` | ✓ | — | — |
| `/health`, `/health/deps` | ochiq | ochiq | ochiq |

## Autentifikatsiya (access / refresh)

```
POST /auth/login {phone, password}
  → { access_token, refresh_token, expires_in, user }
     access_token  — JWT, Authorization: Bearer ..., muddati JWT_EXPIRES_IN (standart 15 daqiqa)
     refresh_token — 48 bayt tasodifiy (base64url), bazada faqat sha256 hash; muddati REFRESH_TOKEN_TTL_DAYS
     expires_in    — access token muddati (soniya)

Access muddati tugaganda (401):
POST /auth/refresh {refresh_token}
  → yangi { access_token, refresh_token, expires_in, user }; eski refresh token bekor qilinadi (rotation)

POST /auth/logout {refresh_token} → { success: true }   (idempotent)
```

- Har refresh tokeni bitta "oila"ga (`family_id` — bitta login) tegishli. **Bekor qilingan token qayta ishlatilsa**
  (o'g'irlangan yoki ikki marta yuborilgan) — butun oila bekor qilinadi va **401** `Sessiya muddati tugagan, qayta kiring`.
  Muddati o'tgan / noma'lum token ham shu 401.
- Mijoz bir vaqtda faqat bitta refresh so'rovi yuborishi kerak (parallel ikkita so'rov qayta ishlatish deb hisoblanadi).
- `PATCH /auth/password` muvaffaqiyatli bo'lsa, admin foydalanuvchining parolini yoki rolini o'zgartirsa, yoki
  shifokor login paroli yangilansa — foydalanuvchining barcha refresh tokenlari bekor qilinadi. Foydalanuvchi
  o'chirilsa tokenlari kaskad bilan o'chadi. Access token esa o'z muddatigacha amal qiladi, lekin har so'rovda
  foydalanuvchi DB dan qayta o'qiladi (o'chirilgan foydalanuvchi darhol 401, rol o'zgarishi darhol kuchga kiradi).
- 7 kundan oldin muddati o'tgan yoki bekor qilingan refresh tokenlar kuniga bir marta o'chiriladi.
- Auth endpointlari rate limit bilan: login 25/daqiqa, refresh 30/daqiqa, parol 10/daqiqa (IP bo'yicha).

## Telegram bot va Eskiz SMS

**Telegram bot** (`TELEGRAM_BOT_TOKEN`):

1. @BotFather → `/newbot` → token. Production va lokal uchun **alohida** botlar ishlating.
2. Bot long polling bilan ishlaydi — webhook va ochiq port kerak emas. Bitta token bilan faqat **bitta** instansiya
   polling qilishi mumkin (aks holda Telegram `409 Conflict`); qo'shimcha replikalarda `TELEGRAM_BOT_ENABLED=false`.
3. Oqim: `/start` → foydalanuvchi telefon raqamini yuboradi → xizmat tanlaydi yoki xabar yozadi → **lid** yaratiladi
   (bir foydalanuvchidan soatiga 3 tagacha).
4. Foydalanuvchi **o'z** kontaktini yuborsa (`contact.user_id === from.id`), raqam `+998XXXXXXXXX` ko'rinishiga
   keltiriladi va shu telefonli (o'chirilmagan) bemor kartalariga `telegram_chat_id` yoziladi — bemor javobida
   `telegramConnected: true`.
5. Eslatmalar: `telegram_chat_id` bor va bot shu jarayonda ishlayotgan bo'lsa — Telegram orqali
   (`telegramReminderTemplate`), aks holda Eskiz SMS (`smsReminderTemplate`). Yuborilmaganlar `failed` bo'lib
   yoziladi va keyingi ishga tushirishda qayta uriniladi.

**Eskiz.uz SMS** (`ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM`):

1. my.eskiz.uz kabinetida hisob, balans va tasdiqlangan jo'natuvchi nomi/raqami (`ESKIZ_FROM`).
2. Eskiz shablon moderatsiyasi talab qilsa, `/settings` dagi `smsReminderTemplate` matnini Eskiz'da ham tasdiqlating.
3. Sozlanmagan bo'lsa SMS yuborilmaydi, eslatmalar `failed` (`skipped`) bo'lib yoziladi.

Shablon placeholderlari: `{name}` (bemor), `{date}` (`DD.MM.YYYY`), `{time}` (`HH:mm`), `{doctor}`, `{clinic}`.
Eslatma oynasi: bugundan `bugun + reminderDaysAhead` gacha (Asia/Tashkent), `pending`/`confirmed` qabullar.

## Docker va CI/CD

**Dockerfile** (multi-stage): `npm ci` → `prisma generate` → `nest build`; runtime image faqat prod dependency'lar,
non-root `nodeuser`, `PORT=7878`, `TZ=Asia/Tashkent`, `HEALTHCHECK` → `GET /health`. Start buyrug'i:
`prisma migrate deploy && exec node dist/src/main.js` (node PID 1 — SIGTERM'da graceful shutdown: Prisma disconnect, bot stop).

**GitHub Actions** (`.github/workflows/docker-deploy.yml`):

| Job | Qachon | Nima qiladi |
|---|---|---|
| `test` | har PR va `main` ga push | `npm ci`, `prisma generate`, type check, ESLint, Jest (coverage) |
| `deploy` | faqat `main` ga push, `test` o'tsa | `docker build -t 10449/zahrodent_backend:<git sha>` → Docker Hub → SSH orqali serverda `docker pull`, eski konteynerni o'chirish, `docker run --network zaxro_network -p 7878:7878 --env-file …/.env` |

Kerakli GitHub secrets: `DOCKERHUB_TOKEN`, `SSH_PRIVATE_KEY`. Batafsil, birinchi deploy, rollback va nginx:
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Health check

| Endpoint | Auth | Javob | Maqsad |
|---|---|---|---|
| `GET /health` | yo'q | `{"status":"ok","timestamp":"…"}` | Liveness — DB ga murojaat qilmaydi (Docker HEALTHCHECK) |
| `GET /health/deps` | yo'q | `{"status":"ok"\|"degraded","db":"ok"\|"down","timestamp","latencyMs"}` | Readiness / monitoring — `SELECT 1` |

```bash
curl -fsS http://127.0.0.1:7878/health
curl -fsS http://127.0.0.1:7878/health/deps
docker inspect --format '{{.State.Health.Status}}' zahrodent_backend
```

## Loglar

- Har so'rovga `X-Request-Id` beriladi (mijoz yuborgan qiymat `[A-Za-z0-9_.:-]{1,128}` bo'lsa o'shani ishlatadi) va
  javob headerida qaytariladi. Shu id **har bir log qatorida** va xato javobida (`requestId`) bor — foydalanuvchi
  xato haqida xabar bersa, `requestId` bo'yicha logdan topiladi.
- `NODE_ENV=production` (yoki `LOG_FORMAT=json`) — har qator bitta JSON:
  ```json
  {"timestamp":"2026-09-30T02:54:37.744Z","level":"warn","context":"AllExceptionsFilter","requestId":"json-check-2","message":"POST /auth/refresh - 401: Sessiya muddati tugagan, qayta kiring","pid":1}
  ```
  Xatolarda `stack` ham shu qatorda. Development'da odatiy rangli Nest formati + `[req:<id>]` prefiksi.
- Production darajalari: `error`, `warn`, `log`. Parollar, tokenlar va ichki DB xatolari mijozga qaytarilmaydi.
- Ko'rish: `docker logs -f --tail 200 zahrodent_backend`; qidirish: `docker logs zahrodent_backend 2>&1 | grep '<requestId>'`
  yoki `| jq 'select(.level=="error")'`. Docker log rotatsiyasini yoqing (DEPLOYMENT.md).

## Backup va restore

`scripts/backup-db.sh` — `pg_dump` custom format + gzip, `RETENTION_DAYS` (standart 14) kundan eski fayllarni
o'chiradi. Postgres Docker konteynerida bo'lsa `PG_CONTAINER=zahro_db`, managed bo'lsa `DATABASE_URL` bilan ishlaydi.

```bash
PG_CONTAINER=zahro_db ./scripts/backup-db.sh
# cron: 15 3 * * * PG_CONTAINER=zahro_db /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/scripts/backup-db.sh >> /home/ubuntu/backups/zahro_dental/backup.log 2>&1
```

Restore bosqichlari va tekshiruv: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#backup-va-restore).

## Muammolarni hal qilish

| Belgisi | Sabab / yechim |
|---|---|
| Start'da `Production: JWT_SECRET majburiy…` | `JWT_SECRET` yo'q yoki < 32 belgi → `openssl rand -base64 48` |
| Start'da `Production: CORS_ORIGINS majburiy…` | Admin panel domenini `CORS_ORIGINS` ga yozing |
| Start'da `INITIAL_ADMIN_PASSWORD majburiy…` | Prod'da ≥ 8 belgili parol (admin allaqachon bo'lsa ham o'zgaruvchi talab qilinadi) |
| `P1001 Can't reach database server` | `DATABASE_URL` hosti: Docker tarmog'ida konteyner nomi (`zahro_db`), `localhost` emas; ikkala konteyner `zaxro_network` da ekanini tekshiring |
| `migrate deploy` `P3009` (failed migration) | `npx prisma migrate status` → sababini tuzating; `prisma migrate resolve --rolled-back <nom>` faqat o'zgarish qo'llanmaganiga ishonch bo'lsa. `reset`/`db push` qilmang |
| Telegram `409 Conflict: terminated by other getUpdates` | Bir token bilan ikki poller (eski konteyner, lokal dev). Faqat bitta instansiya qoldiring |
| SMS kelmaydi, bildirishnoma `failed` | `ESKIZ_*` bo'sh, balans tugagan, jo'natuvchi tasdiqlanmagan yoki telefon noto'g'ri formatda; logda `Eskiz` qatorlarini qidiring |
| Admin panel `CORS` xatosi | Origin `CORS_ORIGINS` da aynan (sxema + domen + port) bo'lishi kerak |
| Hammasi `429 Too Many Requests` | nginx ortida `TRUST_PROXY=1` qo'ying (aks holda barcha so'rovlar bitta IP) |
| 401 `Sessiya muddati tugagan, qayta kiring` | Refresh token muddati o'tgan, chiqilgan yoki qayta ishlatilgan — qayta login |
| Socket ulanmaydi | nginx'da `Upgrade`/`Connection` headerlari, token `auth: { token }` da |

## Xavfsizlik checklist

- [ ] `.env` faqat serverda, `chmod 600`, git'da yo'q (`.gitignore` va `.dockerignore` da bor)
- [ ] `JWT_SECRET` ≥ 32 tasodifiy belgi, dev va prod'da har xil; oshkor bo'lsa almashtiring (hamma qayta login qiladi)
- [ ] `INITIAL_ADMIN_PASSWORD` kuchli; birinchi logindan keyin `PATCH /auth/password` bilan almashtirilgan
- [ ] `NODE_ENV=production`, `SWAGGER_ENABLED=false`, `CORS_ORIGINS` faqat admin domen(lar)i, `TRUST_PROXY=1`
- [ ] API faqat nginx (HTTPS) orqali; 7878 porti tashqariga yopiq (ufw / security group yoki `-p 127.0.0.1:7878:7878`)
- [ ] Postgres porti internetga ochiq emas; kuchli parol; kunlik backup va restore sinovi
- [ ] Telegram bot tokeni va Eskiz paroli faqat `.env` da; git tarixida topilgan tokenlar @BotFather'da **revoke** qilingan
- [ ] Seed (`prisma:seed`) production'da hech qachon ishga tushirilmaydi (kod ham taqiqlaydi)
- [ ] Docker Hub token va SSH kaliti faqat GitHub secrets'da; SSH kalit faqat deploy uchun
- [ ] `npm audit` va bazaviy image yangilanishlari muntazam
