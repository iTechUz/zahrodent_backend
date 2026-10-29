ALTER TABLE "leads" ADD COLUMN "doctor" TEXT, ADD COLUMN "preferred_at" TEXT;
CREATE INDEX "leads_phone_created_at_idx" ON "leads"("phone", "created_at");
