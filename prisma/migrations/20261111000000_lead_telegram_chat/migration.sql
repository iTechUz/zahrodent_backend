-- Leads: Telegram chat of the person (set only when they share their OWN contact with the bot),
-- used to send "application status changed" messages.
ALTER TABLE "leads" ADD COLUMN "telegram_chat_id" TEXT;
