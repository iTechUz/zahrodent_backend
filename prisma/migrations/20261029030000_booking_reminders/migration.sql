ALTER TABLE "bookings"
  ADD COLUMN "reminder_24_sent_at" TIMESTAMP(3),
  ADD COLUMN "reminder_2_sent_at" TIMESTAMP(3),
  ADD COLUMN "patient_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "reschedule_requested_at" TIMESTAMP(3);
