-- Single-row clinic settings (id is always 1) with the default row.
-- Generated with `prisma migrate diff`; CHECK constraint and seed row added by hand.

-- CreateTable
CREATE TABLE "clinic_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "clinic_name" TEXT NOT NULL DEFAULT 'Zahro Dental',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "working_hours" TEXT NOT NULL DEFAULT '',
    "sms_reminder_template" TEXT NOT NULL,
    "telegram_reminder_template" TEXT NOT NULL,
    "reminder_days_ahead" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "clinic_settings_single_row" CHECK ("id" = 1),
    CONSTRAINT "clinic_settings_reminder_days_ahead_range" CHECK ("reminder_days_ahead" BETWEEN 0 AND 7)
);

-- Default row
INSERT INTO "clinic_settings" ("id", "clinic_name", "sms_reminder_template", "telegram_reminder_template", "reminder_days_ahead")
VALUES (
    1,
    'Zahro Dental',
    'Hurmatli {name}, {date} kuni soat {time} da {doctor} qabuliga yozilgansiz. Zahro Dental',
    'Hurmatli {name}, {date} kuni soat {time} da {doctor} qabuliga yozilgansiz. Zahro Dental',
    1
)
ON CONFLICT ("id") DO NOTHING;
