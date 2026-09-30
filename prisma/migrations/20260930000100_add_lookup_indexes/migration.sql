-- Additional lookup indexes (idempotent). Generated with `prisma migrate diff`
-- and made re-runnable with IF NOT EXISTS.

-- Booking conflict check / doctor calendar: WHERE doctor_id = ? AND date = ?
-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_doctor_id_date_idx" ON "bookings"("doctor_id", "date");

-- Patient comments list: WHERE patient_id = ?
-- CreateIndex
CREATE INDEX IF NOT EXISTS "patient_comments_patient_id_idx" ON "patient_comments"("patient_id");

-- Booking → visits (ON DELETE SET NULL lookups)
-- CreateIndex
CREATE INDEX IF NOT EXISTS "visits_booking_id_idx" ON "visits"("booking_id");
