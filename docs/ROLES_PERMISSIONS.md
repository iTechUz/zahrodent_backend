# Rollar va ruxsatlar (Zahro Dental)

Manba: backend `@Roles(...)` guard'lari (`src/<modul>/<modul>.controller.ts`) va admin paneldagi
`src/shared/config/roles.ts`. Ikkalasi bir xil ekani tekshirildi. Tizimda 4 ta rol bor:
**admin** (Administrator), **doctor** (Shifokor), **receptionist** (Qabulxona), **pharmacist** (Apteka).
Belgilar: ✅ ruxsat bor · ❌ yo'q · 🔒 faqat o'z bemorlari/yozuvlari (backend filtrlaydi).

## 1. Menyu (sahifalarga kirish)

| Sahifa | admin | doctor | receptionist | pharmacist |
|---|---|---|---|---|
| Bosh sahifa (Dashboard) | ✅ | ✅ | ✅ | ➡️ Apteka sahifasiga yo'naltiriladi |
| Qabullar | ✅ | ✅ | ✅ | ❌ |
| Bemorlar | ✅ | ✅ | ✅ | ❌ |
| Shifokorlar | ✅ | ❌ | ❌ | ❌ |
| Xizmatlar | ✅ | ❌ | ✅ | ❌ |
| Moliya (to'lovlar) | ✅ | ❌ | ❌ | ❌ |
| Analitika | ✅ | ❌ | ❌ | ❌ |
| Bildirishnomalar | ✅ | ❌ | ✅ | ❌ |
| Leadlar (so'rovlar) | ✅ | ❌ | ✅ | ❌ |
| Apteka (retseptlar) | ✅ | ❌ | ❌ | ✅ |
| Sozlamalar | ✅ | ✅ | ✅ | ❌ |
| Foydalanuvchilar | ✅ | ❌ | ❌ | ❌ |

## 2. Amallar: Kuzatish / Qo'shish / O'zgartirish / O'chirish

| # | Bo'lim | Amal | admin | doctor | receptionist | pharmacist |
|---|---|---|---|---|---|---|
| 1 | Bemorlar | Ko'rish | ✅ | ✅ | ✅ | ❌ |
| 2 | Bemorlar | Qo'shish | ✅ | ❌ | ✅ | ❌ |
| 3 | Bemorlar | O'zgartirish | ✅ | 🔒 | ✅ | ❌ |
| 4 | Bemorlar | O'chirish (arxivga) / tiklash | ✅ | ❌ | ❌ | ❌ |
| 5 | Bemorlar | Izoh qo'shish, statistika | ✅ | ✅ | ✅ | ❌ |
| 6 | Qabullar | Ko'rish | ✅ | ✅ | ✅ | ❌ |
| 7 | Qabullar | Qo'shish / o'zgartirish / bekor qilish / o'chirish | ✅ | ❌ | ✅ | ❌ |
| 8 | Tashriflar (tibbiy tarix) | Ko'rish | ✅ | ✅ | ✅ | ❌ |
| 9 | Tashriflar (tibbiy tarix) | Qo'shish / o'zgartirish | ✅ | ✅ | ❌ | ❌ |
| 10 | Retseptlar | Ko'rish | ✅ | ✅ | ✅ | ❌ |
| 11 | Retseptlar | Yozish / o'zgartirish | ✅ | 🔒 | ❌ | ❌ |
| 12 | Apteka | Retseptni kod/telefon bo'yicha topish va berish | ✅ | ❌ | ❌ | ✅ |
| 13 | Shifokorlar | Ro'yxat / ko'rish | ✅ | ✅ | ✅ | ❌ |
| 14 | Shifokorlar | Qo'shish / o'zgartirish / o'chirish | ✅ | ❌ | ❌ | ❌ |
| 15 | Shifokorlar | Statistika, samaradorlik | ✅ | ❌ | ❌ | ❌ |
| 16 | Xizmatlar | Ko'rish | ✅ | ✅ | ✅ | ❌ |
| 17 | Xizmatlar | Qo'shish / o'zgartirish / o'chirish | ✅ | ❌ | ❌ | ❌ |
| 18 | Xizmatlar | Statistika | ✅ | ❌ | ✅ | ❌ |
| 19 | To'lovlar | Hammasi (ko'rish, kiritish, o'zgartirish, o'chirish) | ✅ | ❌ | ❌ | ❌ |
| 20 | Bildirishnomalar | Ko'rish | ✅ | 🔒 | ✅ | ❌ |
| 21 | Bildirishnomalar | SMS/Telegram yuborish, eslatmalar, ommaviy yuborish | ✅ | ❌ | ✅ | ❌ |
| 22 | Leadlar | Ko'rish / o'zgartirish / o'chirish | ✅ | ❌ | ✅ | ❌ |
| 23 | Leadlar | Saytdan ariza yuborish (ochiq, tokensiz) | — | — | — | — |
| 24 | Analitika / Dashboard | Ko'rish | ✅ | ✅ | ✅ | ❌ |
| 25 | Foydalanuvchilar | Boshqarish (qo'shish, o'zgartirish, o'chirish) | ✅ | ❌ | ❌ | ❌ |
| 26 | Sozlamalar | Ko'rish | ✅ | ✅ | ✅ | ❌ |
| 27 | Sozlamalar | O'zgartirish | ✅ | ❌ | ❌ | ❌ |
| 28 | Profil | O'z parolini o'zgartirish | ✅ | ✅ | ✅ | ✅ |

## 3. Eslatmalar

- Analitika sahifasi menyuda faqat admin uchun, lekin backend `analytics/*` endpoint'lari barcha xodim rollariga
  ochiq (Dashboard raqamlari uchun kerak). Agar doktor/qabulxona analitika ma'lumotini ko'rmasligi kerak bo'lsa,
  endpoint'larni ham `admin` bilan cheklash kerak — **qaror kerak**.
- Doktor uchun "🔒" — backend faqat doktorning o'z bemorlari/retseptlari/bildirishnomalarini qaytaradi.
- `pharmacist` roli faqat Apteka sahifasini ko'radi (retsept kodi yoki telefon bo'yicha topish va berish).
- Google Sheet'dagi jadval (SUPER_ADMIN va boshqa ustunlar) bu hujjatdan ko'chirib to'ldiriladi; sheet'dagi
  rol nomlari tizimdagi 4 ta rolga mos kelishi kerak (sheet'da boshqa nomlar bo'lsa, farqini belgilab chiqish kerak).
