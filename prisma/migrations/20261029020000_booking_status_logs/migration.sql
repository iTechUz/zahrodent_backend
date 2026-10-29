ALTER TABLE "bookings" ADD COLUMN "feedback_rating" INTEGER, ADD COLUMN "feedback_at" TIMESTAMP(3);

CREATE TABLE "booking_status_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "changed_by_id" TEXT,
    "changed_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_status_logs_booking_id_created_at_idx" ON "booking_status_logs"("booking_id", "created_at");

ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
