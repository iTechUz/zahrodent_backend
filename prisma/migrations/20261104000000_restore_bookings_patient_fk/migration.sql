-- Restores bookings_patient_id_fkey where the database lost it. NOT VALID:
-- new writes are checked, existing orphan rows are left for manual repair.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_patient_id_fkey'
      AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_patient_id_fkey"
      FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
