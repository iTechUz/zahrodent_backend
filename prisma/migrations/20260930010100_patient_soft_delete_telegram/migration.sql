-- Patient soft delete (deleted_at) and Telegram chat id for reminders.
-- Generated with `prisma migrate diff`.

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "telegram_chat_id" TEXT;

-- CreateIndex
CREATE INDEX "patients_deleted_at_idx" ON "patients"("deleted_at");
