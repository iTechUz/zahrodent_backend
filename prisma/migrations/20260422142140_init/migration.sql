-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "assigned_doctor_id" TEXT;

-- CreateTable
CREATE TABLE "patient_comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patient_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,

    CONSTRAINT "patient_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_date_status_idx" ON "bookings"("date", "status");

-- CreateIndex
CREATE INDEX "patients_last_name_first_name_idx" ON "patients"("last_name", "first_name");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_assigned_doctor_id_fkey" FOREIGN KEY ("assigned_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_comments" ADD CONSTRAINT "patient_comments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_comments" ADD CONSTRAINT "patient_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
