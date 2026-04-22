-- AlterTable Patients
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "last_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "workplace" TEXT NOT NULL DEFAULT '';
-- Drop old columns if they exist
ALTER TABLE "patients" DROP COLUMN IF EXISTS "name";
ALTER TABLE "patients" DROP COLUMN IF EXISTS "allergies";
ALTER TABLE "patients" DROP COLUMN IF EXISTS "blood_type";

-- AlterTable Doctors
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "last_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "doctors" DROP COLUMN IF EXISTS "name";
ALTER TABLE "doctors" DROP COLUMN IF EXISTS "working_hours";

-- AlterTable Payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'INCOME';
CREATE INDEX IF NOT EXISTS "payments_type_idx" ON "payments"("type");
