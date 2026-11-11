# Zahro Dental API — Deployment qo'llanmasi (DevOps)

Bu hujjat `.github/workflows/cd.yml` (CI → CD), `Dockerfile` va `scripts/backup-db.sh` dagi haqiqiy sozlamalarga
asoslangan. Umumiy ma'lumot va env jadvali: [README.md](../README.md).

---

## 1. Umumiy sxema

```
Internet ──HTTPS──> nginx (80/443, certbot)
                     ├── api.<domen>    ──> 127.0.0.1:7878  zahrodent_backend (Docker, zaxro_network)
                     └── admin.<domen>  ──> admin panel (statik fayllar yoki alohida konteyner)
zahrodent_backend ──> zahro_db (Postgres konteyneri, zaxro_network)  yoki managed PostgreSQL
zahrodent_backend ──> api.telegram.org (long polling), notify.eskiz.uz (SMS)
```

- Image: `10449/zahrodent_backend:<git sha>` (Docker Hub).
- Konteyner nomi: `zahrodent_backend`, tarmoq: `zaxro_network`, port: `7878`.
- Env fayl: `/home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/.env`.
- Migratsiyalar **CD'ning `migrate` job'ida** (yangi image bilan `prisma migrate deploy`, konteyner almashishidan OLDIN)
  bajariladi; konteyner startida migratsiya **yo'q** (distroless image, shell/npx yo'q).
- **Faqat BITTA API instansiyasi ishlating.** Telegram bot long polling qiladi (ikkinchi instansiya `409 Conflict`
  beradi, eslatma/lid xabarlari ikki marta ketishi mumkin) va login bloklash hisoblagichi xotirada (instansiyalar
  o'rtasida bo'lishilmaydi). Gorizontal masshtablash kerak bo'lsa — avval bot'ni alohida jarayonga ajrating
  va lockout'ni umumiy xotiraga (Redis/DB) ko'chiring.

## 2. Server talablari

- Ubuntu 22.04 / 24.04 LTS, kamida 2 vCPU, 2 GB RAM, 20 GB disk (+ backup'lar uchun joy).
- Docker Engine 24+ (`docker compose` plugin ixtiyoriy).
- nginx, certbot (`python3-certbot-nginx`).
- Ochiq portlar: 22 (SSH, iloji bo'lsa IP bilan cheklangan), 80, 443. **7878 va 5432 tashqariga yopiq.**
- Chiquvchi HTTPS: `api.telegram.org`, `notify.eskiz.uz`, Docker Hub.
- Server vaqt zonasi: `sudo timedatectl set-timezone Asia/Tashkent` (cron va backup nomlari uchun qulay).

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu   # qayta login qiling

# nginx + certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# Firewall
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

> Diqqat: Docker `-p 7878:7878` bilan ochilgan port ufw qoidalarini chetlab o'tadi. CD (`cd.yml`) allaqachon
> `-p 127.0.0.1:<PORT>:<PORT>` bilan ishga tushiradi (faqat nginx ko'radi); qo'lda `docker run` qilsangiz ham shunday qiling.

## 3. Docker tarmog'i va PostgreSQL

```bash
docker network create zaxro_network   # bir marta
```

**A variant — Postgres konteynerda** (tavsiya etilgan nom `zahro_db`; mavjud serverda `docker ps` bilan haqiqiy nomni tekshiring):

```bash
sudo mkdir -p /home/ubuntu/pgdata && sudo chown 999:999 /home/ubuntu/pgdata
docker run -d --name zahro_db --restart unless-stopped \
  --network zaxro_network \
  -e POSTGRES_USER=zahro \
  -e POSTGRES_PASSWORD='<openssl rand -base64 32 | tr -d "/+=">' \
  -e POSTGRES_DB=zahro_dental \
  -e TZ=Asia/Tashkent \
  -v /home/ubuntu/pgdata:/var/lib/postgresql/data \
  postgres:15-alpine
# Port publish qilinmaydi — API unga tarmoq ichidan zahro_db:5432 orqali ulanadi.
```

`DATABASE_URL=postgresql://zahro:<parol>@zahro_db:5432/zahro_dental?schema=public`

**B variant — managed PostgreSQL**: provayder bergan URL (`?sslmode=require` kerak bo'lsa qo'shing), serverning IP sini
DB allowlist'iga qo'shing.

## 4. Serverdagi kataloglar

```
/home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/
├── .env                     # production env (chmod 600) — workflow shu faylni --env-file qiladi
└── scripts/backup-db.sh     # repodan nusxa (git clone yoki scp)
/home/ubuntu/backups/zahro_dental/   # backup'lar + backup.log (chmod 700)
/home/ubuntu/pgdata/                 # Postgres ma'lumotlari (A variant)
```

```bash
mkdir -p /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend /home/ubuntu/backups/zahro_dental
cd /home/ubuntu/projects/zaxro_dent/backend
git clone https://github.com/iTechUz/zahrodent_backend.git zahrodent_backend-src   # skript va namuna uchun
cp zahrodent_backend-src/.env.production.example zahrodent_backend/.env
cp -r zahrodent_backend-src/scripts zahrodent_backend/
nano zahrodent_backend/.env      # barcha CHANGE_ME ni to'ldiring
chmod 600 zahrodent_backend/.env
chmod 700 /home/ubuntu/backups/zahro_dental
```

Minimal majburiy qiymatlar: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (≥ 32 belgi), `CORS_ORIGINS`,
`INITIAL_ADMIN_PASSWORD` (≥ 8 belgi, `admin123` emas), `TRUST_PROXY=1`. To'liq ro'yxat: `.env.production.example`.

> **CD `.env` ni har deploy'da qayta yozadi** (GitHub Secrets/Variables'dan; eskisi `.env.bak` ga saqlanadi), shuning
> uchun serverdagi `.env` ni qo'lda tahrirlash keyingi deploy'da yo'qoladi. Hamma qiymat GitHub'da turishi kerak
> (5-bo'lim).

### Muhim env o'zgaruvchilari

| Kalit | Qayerda | Izoh |
|---|---|---|
| `NODE_ENV` | Variable | **Majburiy** (production'da `production`). Dockerfile default'i ham `production`; CD `NODE_ENV` yo'q bo'lsa deploy'ni to'xtatadi. Development muhit ataylab `development` qo'yadi. |
| `TRUST_PROXY` | Variable | **Production'da majburiy** (`1` — nginx ortida). `0`/yo'q bo'lsa API ishga tushadi, lekin logda `TRUST_PROXY o'rnatilmagan` ogohlantirishi chiqadi: barcha so'rovlar nginx IP'sidan kelgandek ko'rinadi → rate limit va login bloklash **global** bo'lib qoladi (bitta mijoz hammani bloklaydi). |
| `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD` | Secret | Majburiy |
| `INITIAL_ADMIN_PHONE`, `CORS_ORIGINS` | Variable | Majburiy. `CORS_ORIGINS` HTTP va WebSocket uchun bir xil ro'yxat; production'da bo'sh bo'lsa API ishga tushmaydi (WebSocket ham yopiq). |
| `TELEGRAM_BOT_TOKEN` | Secret | Bot tokeni. **Repoda default token yo'q** — faqat env'dan o'qiladi. |
| `TELEGRAM_BOT_ENABLED`, `TELEGRAM_LEADS_CHAT_ID`, `TELEGRAM_STATUS_CHAT_ID`, `TELEGRAM_BOOKINGS_TOPIC_ID`, `TELEGRAM_BOT_USERNAME` | Variable | Lidlar guruhi va bot sozlamalari (11-bo'lim) |
| `SWAGGER_ENABLED`, `SWAGGER_USER`, `SWAGGER_PASSWORD` | Variable / Secret | Production'da Swagger **o'chiq** (default). Yoqish uchun `SWAGGER_ENABLED=true` **va** `SWAGGER_USER` + `SWAGGER_PASSWORD` (basic-auth) kerak; faqat `SWAGGER_ENABLED=true` bo'lsa ham production'da o'chiq qoladi. Eslatma: `SWAGGER_USER`/`SWAGGER_PASSWORD` hozir CD'ning `.env` ro'yxatida yo'q — kerak bo'lsa `cd.yml` ro'yxatiga qo'shing. |
| `PORT`, `HOST`, `TZ`, `LOG_FORMAT`, `PUBLIC_BASE_URL`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_TTL_DAYS`, `INITIAL_ADMIN_NAME`, `ESKIZ_*` | Variable/Secret | Ixtiyoriy / README jadvaliga qarang |

```bash
openssl rand -base64 48      # JWT_SECRET
openssl rand -base64 18      # INITIAL_ADMIN_PASSWORD
```

## 5. GitHub secrets

Repository → Settings → Secrets and variables → Actions:

| Secret | Qiymati |
|---|---|
| `DOCKERHUB_TOKEN` | Docker Hub → Account settings → Personal access tokens (Read & Write), foydalanuvchi `10449` |
| `SSH_PRIVATE_KEY` | Deploy uchun alohida kalit (`ssh-keygen -t ed25519 -C zahro-deploy`); public qismi serverda `~ubuntu/.ssh/authorized_keys` ga |
| `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `ESKIZ_*` | Ilova sirlari (CD ularni serverdagi `.env` ga yozadi) |

**Environments**: `main` → `production`, `dev` → `development` (GitHub Settings → Environments; `cd.yml` shunday tanlaydi).
Variables (har environment'da): `SERVER_HOST`, `SERVER_USER`, `DOCKERHUB_USERNAME`, `IMAGE_NAME`, `CONTAINER_NAME`,
`DOCKER_NETWORK`, `ENV_FILE`, `PORT`, **`NODE_ENV`**, **`TRUST_PROXY`** (production'da majburiy), `CORS_ORIGINS`,
`TELEGRAM_*` va hokazo (yuqoridagi jadval). Yetishmasa `Build` job'i boshida `… environment'da yo'q: …` xatosi bilan
to'xtaydi.

Production'da migratsiyadan oldingi zaxira nusxa uchun qo'shimcha (ixtiyoriy) Variables — 6-bo'lim:
`PG_CONTAINER` (masalan `zahro_db`), `PG_USER`, `PG_DATABASE`, `PRE_MIGRATE_BACKUP_DIR`, `PRE_MIGRATE_KEEP`.

## 6. Birinchi deploy

1. 2–5 bo'limlarni bajaring (tarmoq, DB, `.env`, secrets).
2. Workflow'ni ishga tushiring: `main` ga merge → CI muvaffaqiyatli tugagach CD ishlaydi:
   `build` (image + Trivy + Docker Hub) → `prepare` (`.env` yozish + `docker pull`) → `migrate` (production'da
   avval `pg_dump`, keyin `prisma migrate deploy`) → `deploy` (container almashtirish + `/health`; muvaffaqiyatsiz
   bo'lsa oldingi image'ga qaytadi) → `notify`. Qo'lda xuddi shu:
   ```bash
   docker pull 10449/zahrodent_backend:<sha>
   docker run --rm --network zaxro_network --env-file <ENV_FILE> 10449/zahrodent_backend:<sha> \
     node_modules/prisma/build/index.js migrate deploy
   docker rm -f zahrodent_backend || true
   docker run -d --name zahrodent_backend --restart unless-stopped \
     --network zaxro_network -p 127.0.0.1:7878:7878 \
     --env-file /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/.env \
     10449/zahrodent_backend:<sha>
   ```
   (`--log-opt` workflow'da yo'q — log diskni to'ldirmasligi uchun uni `/etc/docker/daemon.json` da global qo'ying:
   `{"log-driver":"json-file","log-opts":{"max-size":"20m","max-file":"5"}}`, so'ng `sudo systemctl restart docker`.)
3. Tekshiring:
   ```bash
   docker logs --tail 100 zahrodent_backend     # "Super admin …", "TRUST_PROXY: yoqildi"
   curl -fsS http://127.0.0.1:7878/health
   curl -fsS http://127.0.0.1:7878/health/deps  # {"status":"ok","db":"ok",...}
   ```
4. nginx + SSL (7-bo'lim), keyin admin panel deploy.
5. Admin panelga `INITIAL_ADMIN_PHONE` bilan kiring va parolni darhol almashtiring (`PATCH /auth/password`).
6. Backup cron'ini yoqing (10-bo'lim) va bitta restore sinovini o'tkazing.

### Migratsiyalar

- Migratsiya CD'ning `migrate` job'ida bajariladi (`prisma migrate deploy`, keyin `migrate diff --exit-code` sxema
  tekshiruvi). Xato bo'lsa `deploy` job'i ishga tushmaydi — eski container ishlashda davom etadi.
- **Production'da migratsiyadan oldin avtomatik `pg_dump`**: `scripts/backup-db.sh` CD runner'dan serverga
  vaqtincha ko'chiriladi va `PRE_MIGRATE_BACKUP_DIR` (default `/home/ubuntu/backups/zahro_dental/pre-migrate`) ga
  `<db>_<vaqt>.dump.gz` yozadi; oxirgi `PRE_MIGRATE_KEEP` (default 10) ta saqlanadi. Dump xato bo'lsa yoki 2 KB dan
  kichik bo'lsa — **deploy to'xtaydi** (migratsiya ham, yangi container ham). `PG_CONTAINER` berilmasa script
  serverdagi `pg_dump` + `ENV_FILE` dagi `DATABASE_URL` ishlatadi (faqat managed DB / host'da ochiq port uchun;
  `zahro_db` kabi Docker ichki host nomi host'dan ko'rinmaydi — Postgres konteynerda bo'lsa `PG_CONTAINER` ni
  albatta qo'ying). Development environment'da bu qadam o'tkazib yuboriladi.
- Migratsiyalar faqat oldinga: rollback'da eski image yangi ustunlar bilan ham ishlaydi (qo'shimcha ustun/jadvallar
  eski kodga xalaqit bermaydi). Ustun o'chiradigan migratsiyalar ikki bosqichda chiqariladi (avval kod, keyin schema).
  CI (`migrations` job, `scripts/check-migrations.sh`) PR'dagi yangi migratsiyada `DROP COLUMN`, `DROP TABLE`,
  `ALTER COLUMN … TYPE` topsa, faylda `-- allow-destructive` izohi bo'lmaguncha qizil bo'ladi.
- Hech qachon `migrate dev`, `migrate reset`, `db push` ni production bazaga qarshi ishlatmang.
- Holat: `docker run --rm --network zaxro_network --env-file <ENV_FILE> 10449/zahrodent_backend:<sha> node_modules/prisma/build/index.js migrate status`
  (image distroless — `docker exec … prisma` / shell yo'q).

## 7. nginx reverse proxy va SSL

DNS: `api.<domen>` va `admin.<domen>` A-yozuvlari server IP siga.

`/etc/nginx/sites-available/zahro-api`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name api.example.uz;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:7878;
        proxy_http_version 1.1;

        # WebSocket (Socket.IO) upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;   # nginx va API loglarini bog'lash uchun

        proxy_read_timeout 75s;   # Socket.IO ping'lari uchun yetarli
        proxy_send_timeout 75s;
    }
}
```

`/etc/nginx/sites-available/zahro-admin` (admin panel statik build bo'lsa):

```nginx
server {
    listen 80;
    server_name admin.example.uz;
    root /var/www/zahro-admin;      # admin panel build (dist/) shu yerga
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA routing
    }
    location ~* \.(js|css|png|jpg|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Admin panel konteyner bo'lib ishlasa, `root`/`try_files` o'rniga `proxy_pass http://127.0.0.1:<admin port>;`.

```bash
sudo ln -s /etc/nginx/sites-available/zahro-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/zahro-admin /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d api.example.uz -d admin.example.uz --redirect -m admin@example.uz --agree-tos
sudo certbot renew --dry-run    # avtomatik yangilanish (systemd timer) ishlashini tekshirish
```

`.env` da: `TRUST_PROXY=1`, `CORS_ORIGINS=https://admin.example.uz`, `PUBLIC_BASE_URL=https://api.example.uz`.
Admin panelda API manzili `https://api.example.uz`.

## 8. Deploy tartibi

1. **Backend avval.** API o'zgarishlari orqaga mos (yangi maydonlar qo'shiladi, eskilari qoladi), shuning uchun eski
   admin panel yangi backend bilan ishlayveradi.
2. `curl https://api.<domen>/health/deps` → `ok`, loglarda xato yo'q.
3. **Keyin admin panel.** Yangi panel yangi endpointlarga (masalan `/auth/refresh`, `/settings`) tayanadi.
4. Rollback teskari tartibda: avval panel, keyin backend.

## 9. Rollback

**Tartib muhim: migratsiya container almashishidan OLDIN qo'llanadi.** Demak `deploy` job'i muvaffaqiyatsiz
bo'lsa (health check o'tmasa) CD oldingi image'ni qayta ko'taradi, lekin baza allaqachon YANGI sxemada. Bu xavfsiz,
chunki migratsiyalar faqat qo'shuvchi (additive) bo'lishi kerak — eski kod yangi ustun/indekslarga e'tibor bermaydi.
Destruktiv migratsiya bo'lsa (`-- allow-destructive`), eski kod ishlamasligi mumkin — shunda restore kerak.

**Downtime**: container almashishi `docker rm -f` + `docker run` (stop-start), ya'ni deploy paytida bir necha soniya
API yo'q (bitta instansiya qoidasi tufayli parallel ishga tushirib bo'lmaydi). "Oldingi container'ni qayta nomlab
saqlash" ataylab qo'shilmagan: bitta port va Telegram polling bitta instansiyaga ruxsat beradi, shuning uchun eski
container baribir to'xtatilishi kerak; hozirgi `PREV` image'dan qayta ko'tarish xuddi shu natijani beradi.

Har deploy image'i git SHA bilan teglangan. Oldingi versiyaga qaytish:

```bash
# Qaysi SHA ishlayotgan edi:
docker inspect --format '{{.Config.Image}}' zahrodent_backend
docker images 10449/zahrodent_backend --format '{{.Tag}} {{.CreatedAt}}'   # serverda qolgan image'lar
# yoki GitHub → Actions → oxirgi muvaffaqiyatli deploy'lar / git log --first-parent main

PREV=<oldingi_sha>
docker pull 10449/zahrodent_backend:$PREV
docker rm -f zahrodent_backend
docker run -d --name zahrodent_backend --restart unless-stopped \
  --network zaxro_network -p 127.0.0.1:7878:7878 \
  --env-file /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/.env \
  10449/zahrodent_backend:$PREV
curl -fsS http://127.0.0.1:7878/health/deps
```

- Agar `.env` ham o'zgargan bo'lsa, oldingisi `.env.bak` da (CD avtomatik tiklaydi; qo'lda: `cp .env.bak .env`).
- Migratsiyalar orqaga qaytarilmaydi — eski image qo'shimcha ustun/jadvallar bilan ishlaydi. Ma'lumot buzilgan
  bo'lsa — migratsiyadan oldingi dump (`…/pre-migrate/`) yoki 10-bo'limdagi restore.
- Keyin `main` ga revert PR ochib, CI orqali tuzatilgan versiyani chiqaring (qo'lda qo'yilgan konteyner keyingi
  deployda almashtiriladi).
- Diskni tozalash: CD o'zi 168 soatdan eski image'larni o'chiradi; qo'lda: `docker image prune -a --filter "until=720h"`.

## 10. Backup va restore

### Backup

`scripts/backup-db.sh`: `pg_dump -Fc` (custom format) → gzip → `<db>_YYYYmmdd_HHMMSS.dump.gz`, `gzip -t` tekshiruvi,
`RETENTION_DAYS` (standart 14) kundan eskilarini o'chiradi, bir vaqtda bitta jarayon (`flock`).

| O'zgaruvchi | Standart | Izoh |
|---|---|---|
| `PG_CONTAINER` | — | Postgres konteyner nomi (`zahro_db`) — `docker exec … pg_dump` |
| `PGUSER` / `PGDATABASE` | `postgres` / `zahro_dental` | konteyner rejimi uchun (`POSTGRES_USER` ga moslang) |
| `DATABASE_URL` | `.env` dan | host'dagi `pg_dump` bilan (managed DB); `?schema=` avtomatik olib tashlanadi |
| `BACKUP_DIR` | `/home/ubuntu/backups/zahro_dental` | |
| `RETENTION_DAYS` | `14` | |
| `ENV_FILE` | `/home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/.env` | |
| `KEEP_LAST` | — | berilsa: yosh bo'yicha emas, oxirgi N ta fayl saqlanadi (CD pre-migrate dump'lari) |
| `MIN_BYTES` | `100` | arxiv shundan kichik bo'lsa script xato bilan tugaydi |
| `HEARTBEAT_URL` | — | muvaffaqiyatli tugagach GET qilinadi (healthchecks.io dead-man switch: cron to'xtab qolsa xabar keladi) |
| `HEARTBEAT_FAIL_URL` | — | xato bilan tugaganda GET qilinadi (healthchecks.io: `<ping-url>/fail`) |

```bash
# Qo'lda
PG_CONTAINER=zahro_db PGUSER=zahro /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/scripts/backup-db.sh

# Cron (crontab -e, ubuntu foydalanuvchisi) — har kuni 03:15
15 3 * * * PG_CONTAINER=zahro_db PGUSER=zahro /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/scripts/backup-db.sh >> /home/ubuntu/backups/zahro_dental/backup.log 2>&1
```

Heartbeat bilan cron: `HEARTBEAT_URL=https://hc-ping.com/<uuid> HEARTBEAT_FAIL_URL=https://hc-ping.com/<uuid>/fail …`.
healthchecks.io'da period 1 kun, grace 2 soat qo'ying — backup o'tkazib yuborilsa xabar keladi.

Managed DB / host rejimi uchun `sudo apt install -y postgresql-client-15` (server versiyasidan past bo'lmasin).
Backup'larni boshqa joyga ham ko'chiring (S3 / boshqa server, masalan `rclone copy` yoki `rsync` cron'i) — bitta
serverdagi backup server yo'qolsa foyda bermaydi.

### Restore

1. API ni to'xtating (yozuvlar bo'lmasligi uchun): `docker stop zahrodent_backend`.
2. (Tavsiya) joriy holatdan ham backup oling: `PG_CONTAINER=zahro_db PGUSER=zahro ./scripts/backup-db.sh`.
3. Tiklash:
   ```bash
   FILE=/home/ubuntu/backups/zahro_dental/zahro_dental_20260930_031500.dump.gz

   # Konteyner rejimi
   gunzip -c "$FILE" | docker exec -i zahro_db pg_restore -U zahro -d zahro_dental --clean --if-exists --no-owner --single-transaction

   # Managed DB (DATABASE_URL dan ?schema=... olib tashlangan holda)
   gunzip -c "$FILE" | pg_restore --dbname="postgresql://zahro:***@host:5432/zahro_dental" --clean --if-exists --no-owner --single-transaction
   ```
   Butunlay yangi bazaga tiklash: avval `createdb` (`docker exec zahro_db createdb -U zahro zahro_dental_restore`),
   so'ng `-d zahro_dental_restore` va `DATABASE_URL` ni shunga almashtiring.
4. API ni ishga tushiring: `docker start zahrodent_backend` — start'da `migrate deploy` backup'dan keyingi
   migratsiyalarni qayta qo'llaydi.
5. Tekshiring: `curl -fsS http://127.0.0.1:7878/health/deps`, admin panelda bemorlar/to'lovlar soni.

Faqat arxiv tarkibini ko'rish: `gunzip -c "$FILE" | docker exec -i zahro_db pg_restore --list | head`.

### Oylik restore mashqi (drill)

Backup faqat tiklab ko'rilganda "bor" hisoblanadi. **Oyiga bir marta** (kalendarga qo'ying):

1. Eng yangi dump'ni oling (`ls -t /home/ubuntu/backups/zahro_dental/*.dump.gz | head -1`) va `gzip -t "$FILE"`.
2. **Ishlab turgan bazaga tegmasdan** alohida bazaga tiklang:
   ```bash
   docker exec zahro_db createdb -U zahro zahro_dental_drill
   gunzip -c "$FILE" | docker exec -i zahro_db pg_restore -U zahro -d zahro_dental_drill --no-owner --single-transaction
   ```
3. Tekshiring: jadvallar soni va asosiy sonlar production bilan mos (taxminan):
   ```bash
   docker exec zahro_db psql -U zahro -d zahro_dental_drill -c "SELECT (SELECT count(*) FROM patients) p, (SELECT count(*) FROM payments) pay, (SELECT max(date) FROM visits) last_visit;"
   ```
4. Tozalang: `docker exec zahro_db dropdb -U zahro zahro_dental_drill`.
5. Natijani (sana, dump nomi, hajm, davomiyligi) jurnalga yozing. Xato bo'lsa — darhol backup jarayonini tuzating.

## 11. Monitoring va xizmat ko'rsatish

- Uptime monitor (UptimeRobot, Better Stack…) → `https://api.<domen>/health` (liveness) va `/health/deps`
  (DB down → **503**; javobda `telegram`: `ok`/`down`/`disabled`; bot `down` bo'lsa 200 + `status:"degraded"`).
- **Avtomatik monitor** (`.github/workflows/uptime.yml` + `scripts/uptime-monitor.sh`, har 5 daqiqa): sayt, API
  `/health/deps` va bot holatini tekshiradi; ketma-ket 2 xatodan keyin Telegramga `🔴 …`, tiklanganda `🟢 …` (faqat
  holat o'zgarganda). Sozlash: repo → Settings → Secrets and variables → Actions:
  variables `SITE_URL` (frontend public URL), `API_URL` (`https://api.<domen>`, oxirida `/`siz);
  secrets `TG_ALERT_BOT_TOKEN`, `TG_ALERT_CHAT_ID` (admin chat). O'chirish: Actions → Uptime monitor → Disable.
  Qo'lda sinash: `SITE_URL=… API_URL=… ./scripts/uptime-monitor.sh` (token bo'lmasa faqat konsolga chiqaradi).
- Lidlar guruhi: `TELEGRAM_LEADS_CHAT_ID` (README → Telegram bot, 5-band). `.env` har deploy'da CD tomonidan
  qayta yoziladi, shuning uchun bu qiymatlar **GitHub → Settings → Secrets and variables → Actions → Variables**
  (environment: production) da turishi shart: `TELEGRAM_LEADS_CHAT_ID`, `TELEGRAM_STATUS_CHAT_ID` (ixtiyoriy),
  `TELEGRAM_BOOKINGS_TOPIC_ID` (ixtiyoriy), `TELEGRAM_BOT_USERNAME`. Aks holda landing formadan kelgan murojaat
  bazaga tushadi, lekin guruhga xabar ketmaydi.
- Konteyner holati: `docker ps`, `docker inspect --format '{{.State.Health.Status}}' zahrodent_backend`.
- Loglar: `docker logs -f --tail 200 zahrodent_backend`; production'da har qator JSON —
  `docker logs zahrodent_backend 2>&1 | jq -c 'select(.level=="error")'`, bitta so'rov: `grep '<requestId>'`.
- Refresh tokenlar kuniga bir marta avtomatik tozalanadi; eslatmalar `POST /notifications/send-reminders` orqali
  ishga tushiriladi (avtomatik cron yo'q).
- Bitta API instansiyasi qoidasi (1-bo'lim). Majburan bir nechta ishga tushirilsa: faqat bittasida
  `TELEGRAM_BOT_ENABLED=true`; login bloklash baribir instansiya bo'yicha alohida hisoblanadi.
- Sirlarni almashtirish: `.env` ni tahrirlang → `docker restart zahrodent_backend` yetmaydi (`--env-file` faqat
  `docker run` da o'qiladi) — konteynerni qayta yarating (9-bo'limdagi `docker rm -f` + `docker run` joriy SHA bilan) yoki GitHub Variables'ni yangilab CD'ni qayta ishga tushiring.
