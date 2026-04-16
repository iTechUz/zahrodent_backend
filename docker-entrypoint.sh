#!/bin/sh
set -e

echo "═══════════════════════════════════════"
echo "  Zahro Dental Backend — Starting..."
echo "═══════════════════════════════════════"

# PostgreSQL tayyor bo'lishini kutish
echo "⏳  PostgreSQL kutilmoqda..."
until npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; do
  sleep 2
done
echo "✅  PostgreSQL tayyor"

# Migrations
echo "⏳  Migrations ishga tushirilmoqda..."
npx prisma migrate deploy
echo "✅  Migrations tugadi"

# Seed (faqat birinchi ishga tushirilganda)
if [ "$RUN_SEED" = "true" ]; then
  echo "⏳  Seed ma'lumotlar yuklanmoqda..."
  node dist/prisma/seed.js 2>/dev/null || echo "⚠️   Seed o'tkazib yuborildi (allaqachon mavjud)"
fi

echo "🚀  Server ishga tushirilmoqda..."
exec "$@"
