-- Public form tili (uz|ru|en) va eskirgan xabarlarni yubormaslik uchun muddat.
ALTER TABLE "leads" ADD COLUMN "lang" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN "expires_at" TIMESTAMP(3);
