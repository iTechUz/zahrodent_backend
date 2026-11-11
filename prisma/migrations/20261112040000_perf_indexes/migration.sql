-- Qo'shimcha indekslar (faqat CREATE INDEX, ma'lumotga tegmaydi; jadvallar kichik).
-- Hisobot/ro'yxat so'rovlari: shifokor + sana, to'lov turi/holati + sana, bemor + sana.
CREATE INDEX IF NOT EXISTS "visits_doctor_id_date_idx" ON "visits"("doctor_id", "date");
CREATE INDEX IF NOT EXISTS "payments_type_status_date_idx" ON "payments"("type", "status", "date");
CREATE INDEX IF NOT EXISTS "payments_patient_id_date_idx" ON "payments"("patient_id", "date");
CREATE INDEX IF NOT EXISTS "bookings_patient_id_date_idx" ON "bookings"("patient_id", "date");
-- bookings(doctor_id, date) allaqachon bor (bookings_doctor_id_date_idx).
