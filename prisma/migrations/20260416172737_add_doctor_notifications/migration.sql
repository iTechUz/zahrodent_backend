-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "doctor_id" TEXT,
ALTER COLUMN "patient_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
