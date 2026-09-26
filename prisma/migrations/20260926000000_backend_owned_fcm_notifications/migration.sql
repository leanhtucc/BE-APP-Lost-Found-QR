ALTER TABLE "user_devices"
  ADD COLUMN IF NOT EXISTS "device_name" VARCHAR(255);

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "title_en" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "content_en" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "attachment" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "entity_type" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "entity_id" TEXT,
  ADD COLUMN IF NOT EXISTS "action" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Existing Vietnamese content remains usable, while old rows receive a safe
-- English fallback until their next domain-generated notification.
UPDATE "Notification"
SET "title_en" = "title"
WHERE "title_en" = '';

UPDATE "Notification"
SET "content_en" = "content"
WHERE "content_en" = '';

CREATE INDEX IF NOT EXISTS "Notification_receiver_id_deleted_at_created_at_idx"
  ON "Notification"("receiver_id", "deleted_at", "created_at");
