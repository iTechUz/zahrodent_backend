-- Patients: store birth year (age goes stale). `age` stays as a snapshot for
-- compatibility. Backfill is approximate (registration year − age); rows with
-- age 0 (unknown, e.g. created from a lead) are left NULL.
ALTER TABLE "patients" ADD COLUMN "birth_year" INTEGER;

UPDATE "patients"
SET "birth_year" = EXTRACT(YEAR FROM "created_at")::int - "age"
WHERE "age" > 0;
