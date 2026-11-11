-- Payments trail + clinic expenses without a patient.
ALTER TABLE "payments" ALTER COLUMN "patient_id" DROP NOT NULL;
ALTER TABLE "payments" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payments" ADD COLUMN "created_by_id" TEXT;

CREATE TABLE "payment_audits" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_audits_payment_id_created_at_idx" ON "payment_audits"("payment_id", "created_at");
