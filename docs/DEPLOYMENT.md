# Zahro Dental API — Deployment qo'llanmasi (DevOps)

Bu hujjat `.github/workflows/docker-deploy.yml`, `Dockerfile` va `scripts/backup-db.sh` dagi haqiqiy sozlamalarga
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
- Migratsiyalar konteyner startida avtomatik (`prisma migrate deploy`).

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

> Diqqat: Docker `-p 7878:7878` bilan ochilgan port ufw qoidalarini chetlab o'tadi. Tashqaridan yopish uchun
> bulut security group'ida 7878 ni yoping yoki workflow'dagi `-p 7878:7878` ni `-p 127.0.0.1:7878:7878` ga almashtiring
> (nginx shu serverda bo'lsa).

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

Server manzili (`116.203.244.91`) va foydalanuvchi (`ubuntu`) workflow faylida yozilgan; server almashsa — workflow'ni yangilang.

## 6. Birinchi deploy

1. 2–5 bo'limlarni bajaring (tarmoq, DB, `.env`, secrets).
2. Workflow'ni ishga tushiring: `main` ga merge (PR squash-merge) — `test` job o'tgach `deploy` job image'ni yig'adi,
   push qiladi va serverda konteynerni ishga tushiradi. Qo'lda xuddi shu:
   ```bash
   docker pull 10449/zahrodent_backend:<sha>
   docker rm -f zahrodent_backend || true
   docker run -d --name zahrodent_backend --restart unless-stopped \
     --network zaxro_network -p 7878:7878 \
     --log-opt max-size=20m --log-opt max-file=5 \
     --env-file /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/.env \
     10449/zahrodent_backend:<sha>
   ```
   (`--log-opt` workflow'da yo'q — log diskni to'ldirmasligi uchun uni `/etc/docker/daemon.json` da global qo'ying:
   `{"log-driver":"json-file","log-opts":{"max-size":"20m","max-file":"5"}}`, so'ng `sudo systemctl restart docker`.)
3. Tekshiring:
   ```bash
   docker logs --tail 100 zahrodent_backend     # "All migrations have been successfully applied", "Super admin …"
   curl -fsS http://127.0.0.1:7878/health
   curl -fsS http://127.0.0.1:7878/health/deps  # {"status":"ok","db":"ok",...}
   ```
4. nginx + SSL (7-bo'lim), keyin admin panel deploy.
5. Admin panelga `INITIAL_ADMIN_PHONE` bilan kiring va parolni darhol almashtiring (`PATCH /auth/password`).
6. Backup cron'ini yoqing (10-bo'lim) va bitta restore sinovini o'tkazing.

### Migratsiyalar

- Konteyner har startda `prisma migrate deploy` bajaradi; xato bo'lsa konteyner ishga tushmaydi
  (`docker logs zahrodent_backend` da `P3009`/`P3018`), eski versiya esa allaqachon o'chirilgan — shuning uchun
  **schema o'zgaradigan deploydan oldin backup oling** (`scripts/backup-db.sh`).
- Migratsiyalar faqat oldinga: rollback'da eski image yangi ustunlar bilan ham ishlaydi (qo'shimcha ustun/jadvallar
  eski kodga xalaqit bermaydi). Ustun o'chiradigan migratsiyalar ikki bosqichda chiqariladi (avval kod, keyin schema).
- Hech qachon `migrate dev`, `migrate reset`, `db push` ni production bazaga qarshi ishlatmang.
- Holat: `docker exec zahrodent_backend ./node_modules/.bin/prisma migrate status`.

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
  --network zaxro_network -p 7878:7878 \
  --env-file /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/.env \
  10449/zahrodent_backend:$PREV
curl -fsS http://127.0.0.1:7878/health/deps
```

- Migratsiyalar orqaga qaytarilmaydi — eski image qo'shimcha ustun/jadvallar bilan ishlaydi. Ma'lumot buzilgan
  bo'lsa — 10-bo'limdagi restore.
- Keyin `main` ga revert PR ochib, CI orqali tuzatilgan versiyani chiqaring (qo'lda qo'yilgan konteyner keyingi
  deployda almashtiriladi).
- Diskni tozalash: `docker image prune -a --filter "until=720h"` (oxirgi bir necha SHA ni qoldiring).

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

```bash
# Qo'lda
PG_CONTAINER=zahro_db PGUSER=zahro /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/scripts/backup-db.sh

# Cron (crontab -e, ubuntu foydalanuvchisi) — har kuni 03:15
15 3 * * * PG_CONTAINER=zahro_db PGUSER=zahro /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/scripts/backup-db.sh >> /home/ubuntu/backups/zahro_dental/backup.log 2>&1
```

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
Oyiga kamida bir marta restore'ni alohida bazaga sinab ko'ring.

## 11. Monitoring va xizmat ko'rsatish

- Uptime monitor (UptimeRobot, Better Stack…) → `https://api.<domen>/health` (liveness) va `/health/deps` (DB).
- Konteyner holati: `docker ps`, `docker inspect --format '{{.State.Health.Status}}' zahrodent_backend`.
- Loglar: `docker logs -f --tail 200 zahrodent_backend`; production'da har qator JSON —
  `docker logs zahrodent_backend 2>&1 | jq -c 'select(.level=="error")'`, bitta so'rov: `grep '<requestId>'`.
- Refresh tokenlar kuniga bir marta avtomatik tozalanadi; eslatmalar `POST /notifications/send-reminders` orqali
  ishga tushiriladi (avtomatik cron yo'q).
- Bir nechta API replikasi ishga tushirilsa: faqat bittasida `TELEGRAM_BOT_ENABLED=true`. Telegram eslatmalari bot
  ishlayotgan jarayonda yuboriladi; boshqa replikaga tushgan `send-reminders` so'rovi bemorlarga SMS yuboradi.
- Sirlarni almashtirish: `.env` ni tahrirlang → `docker restart zahrodent_backend` yetmaydi (`--env-file` faqat
  `docker run` da o'qiladi) — konteynerni qayta yarating (9-bo'limdagi `docker rm -f` + `docker run` joriy SHA bilan).
