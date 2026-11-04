-- Soft delete: hard delete taqiqlangan, qatorlar deleted_at bilan yashiriladi.
-- Faqat nullable ustun + indeks: mavjud ma'lumot va eski kod buzilmaydi.
ALTER TABLE "users"    ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "doctors"  ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "services" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "leads"    ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "users_deleted_at_idx"    ON "users"("deleted_at");
CREATE INDEX "doctors_deleted_at_idx"  ON "doctors"("deleted_at");
CREATE INDEX "services_deleted_at_idx" ON "services"("deleted_at");
CREATE INDEX "bookings_deleted_at_idx" ON "bookings"("deleted_at");
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");
CREATE INDEX "leads_deleted_at_idx"    ON "leads"("deleted_at");
