# Zahro Dental API — Deployment & DevOps Guide

Bu qo'llanma Zahro Dental boshqaruv tizimi backendini serverga o'rnatish va uni to'g'ri konfiguratsiya qilish uchun mo'ljallangan.

## 📋 Tizim talablari
- **Node.js**: v18 yoki undan yuqori
- **PostgreSQL**: v14 yoki undan yuqori
- **PM2**: Node.js jarayonlarini boshqarish uchun (tavsiya etiladi)

---

## 🚀 O'rnatish (Step-by-step)

1. **Repo'ni klonlash va paketlarni o'rnatish**:
   ```bash
   npm install
   ```

2. **Prisma client'ni generatsiya qilish**:
   ```bash
   npm run prisma:generate
   ```

3. **Database migratsiya va seed**:
   ```bash
   # Migratsiyalarni DB ga o'tkazish
   npm run prisma:migrate:deploy
   
   # Super adminni yaratish (faqat bir marta)
   npm run prisma:seed
   ```

4. **Loyihani build qilish**:
   ```bash
   npm run build
   ```

---

## ⚙️ Environment Variables (.env)

Production muhitida quyidagi o'zgaruvchilar to'g'ri sozlangan bo'lishi shart:

| O'zgaruvchi | Tavsif | Muhimlik |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL ulanish manzili | Majburiy |
| `JWT_SECRET` | Tokenlarni imzolash uchun kalit (kamida 32 belgi) | Majburiy |
| `PORT` | Server tinglaydigan port (default: 3000) | Ixtiyoriy |
| `CORS_ORIGINS` | Frontend domenlari (vergul bilan, masalan: `https://dental.uz`) | Majburiy (Prod) |
| `TRUST_PROXY` | `1` qiling (Nginx ortida bo'lsa) | Tavsiya |
| **INITIAL_ADMIN_PHONE** | Tizim yaratadigan super admin telefoni | Majburiy |
| **INITIAL_ADMIN_PASSWORD** | Super admin paroli (kamida 8 belgi) | Majburiy |

> [!CAUTION]
> Production muhitda `INITIAL_ADMIN_PASSWORD` o'zgaruvchisi `admin123` bo'lishi mumkin emas. Aks holda server xavfsizlik nuqtai nazaridan ishga tushmaydi.

---

## 📦 PM2 bilan ishga tushirish

`ecosystem.config.js` faylini yarating:

```javascript
module.exports = {
  apps: [{
    name: 'zahro-backend',
    script: 'dist/src/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

Ishga tushirish uchun: `pm2 start ecosystem.config.js`

---

## 🛡️ Nginx Konfiguratsiyasi

Nginx orqali backend'ni ulashda quyidagi sarlavhalarni (headers) uzatishni unutmang:

```nginx
location /api/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 🩺 Monitoring va Healthcheck

Server holatini tekshirish uchun:
- **Health check**: `GET /health`
- **Swagger Docs**: `/swagger` (Faqat `SWAGGER_ENABLED=true` bo'lsa)

## 🛠️ Xizmat ko'rsatish (Maintenance)

- **Loglarni ko'rish**: `pm2 logs zahro-backend`
- **Restart**: `pm2 restart zahro-backend`
- **DB yangilash**: Schema o'zgarganda `npx prisma migrate deploy` komandasini bering.
