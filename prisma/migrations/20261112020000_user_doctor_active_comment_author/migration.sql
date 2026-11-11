-- Xodim/shifokorni o'chirmasdan faolsizlantirish; sharhlar muallif o'chirilganda yo'qolmasin.
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "doctors" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "patient_comments" ADD COLUMN "author_name" TEXT;
UPDATE "patient_comments" c SET "author_name" = u."name" FROM "users" u WHERE u."id" = c."author_id";

ALTER TABLE "patient_comments" ALTER COLUMN "author_id" DROP NOT NULL;
ALTER TABLE "patient_comments" DROP CONSTRAINT "patient_comments_author_id_fkey";
ALTER TABLE "patient_comments" ADD CONSTRAINT "patient_comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
