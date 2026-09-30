-- 20260424130000_add_leads was committed empty, so the "leads" table was never
-- created by `prisma migrate deploy`. Some environments may already have it
-- (created by hand / db push), so everything here is idempotent.
--
-- Generated from `prisma migrate diff --from-migrations prisma/migrations
-- --to-schema-datamodel prisma/schema.prisma` and made re-runnable.
-- The Lead model uses plain TEXT for status/source (no Postgres enum types),
-- so no enum DDL is required.

-- CreateTable
CREATE TABLE IF NOT EXISTS "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "service" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT NOT NULL DEFAULT 'telegram_bot',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leads_created_at_idx" ON "leads"("created_at");

-- Missing foreign-key / filter indexes (Postgres does not index FKs automatically).
-- Used by doctor scoping (visits.doctor_id), patient balances (visits.patient_id),
-- payments by visit, notification history and the patients' assigned doctor filter.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_patient_id_idx" ON "notifications"("patient_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_doctor_id_idx" ON "notifications"("doctor_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_sent_at_idx" ON "notifications"("sent_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "patients_assigned_doctor_id_idx" ON "patients"("assigned_doctor_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_visit_id_idx" ON "payments"("visit_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visits_patient_id_idx" ON "visits"("patient_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visits_doctor_id_idx" ON "visits"("doctor_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visits_date_idx" ON "visits"("date");
