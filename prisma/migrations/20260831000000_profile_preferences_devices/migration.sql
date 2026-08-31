-- Profile persistence, notification preferences, multi-device push, and
-- security/account lifecycle support.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "token_valid_after" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deletion_requested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduled_deletion_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "anonymized_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_scheduled_deletion_at_anonymized_at_idx"
  ON "User"("scheduled_deletion_at", "anonymized_at");

-- Preserve installations that used the pre-migration Prisma model names.
DO $$
BEGIN
  IF to_regclass('"NotificationPreference"') IS NOT NULL
     AND to_regclass('user_preferences') IS NULL THEN
    ALTER TABLE "NotificationPreference" RENAME TO "user_preferences";
  END IF;
  IF to_regclass('"UserDevice"') IS NOT NULL
     AND to_regclass('user_devices') IS NULL THEN
    ALTER TABLE "UserDevice" RENAME TO "user_devices";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "push_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  "proximity_enabled" BOOLEAN NOT NULL DEFAULT true,
  "notification_radius_meters" INTEGER NOT NULL DEFAULT 3000,
  "language" VARCHAR(5) NOT NULL DEFAULT 'vi',
  "important_enabled" BOOLEAN NOT NULL DEFAULT true,
  "transaction_enabled" BOOLEAN NOT NULL DEFAULT true,
  "item_enabled" BOOLEAN NOT NULL DEFAULT true,
  "social_enabled" BOOLEAN NOT NULL DEFAULT true,
  "daily_digest_enabled" BOOLEAN NOT NULL DEFAULT true,
  "nearby_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
  "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT true,
  "quiet_start" TEXT NOT NULL DEFAULT '22:00',
  "quiet_end" TEXT NOT NULL DEFAULT '07:00',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "daily_digest_time" TEXT NOT NULL DEFAULT '19:30',
  "nearby_radius" INTEGER NOT NULL DEFAULT 3000,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "proximity_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notification_radius_meters" INTEGER NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS "language" VARCHAR(5) NOT NULL DEFAULT 'vi';

UPDATE "user_preferences"
SET
  "nearby_radius" = LEAST(GREATEST("nearby_radius", 100), 5000),
  "notification_radius_meters" = LEAST(GREATEST("nearby_radius", 100), 5000),
  "proximity_enabled" = "nearby_alerts_enabled";

CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_id_key"
  ON "user_preferences"("user_id");

ALTER TABLE "user_preferences"
  DROP CONSTRAINT IF EXISTS "user_preferences_radius_check",
  DROP CONSTRAINT IF EXISTS "user_preferences_language_check";
ALTER TABLE "user_preferences"
  ADD CONSTRAINT "user_preferences_radius_check"
    CHECK ("notification_radius_meters" BETWEEN 100 AND 5000),
  ADD CONSTRAINT "user_preferences_language_check"
    CHECK ("language" IN ('vi', 'en'));

CREATE TABLE IF NOT EXISTS "user_devices" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "push_token" TEXT NOT NULL,
  "platform" VARCHAR(20) NOT NULL DEFAULT 'android',
  "device_id" VARCHAR(255) NOT NULL,
  "app_version" TEXT,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_devices_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_devices' AND column_name = 'token'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_devices' AND column_name = 'push_token'
  ) THEN
    ALTER TABLE "user_devices" RENAME COLUMN "token" TO "push_token";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_devices' AND column_name = 'last_active_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_devices' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE "user_devices" RENAME COLUMN "last_active_at" TO "last_seen_at";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_devices' AND column_name = 'is_active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_devices' AND column_name = 'enabled'
  ) THEN
    ALTER TABLE "user_devices" RENAME COLUMN "is_active" TO "enabled";
  END IF;
END $$;

ALTER TABLE "user_devices"
  ADD COLUMN IF NOT EXISTS "app_version" TEXT;
ALTER TABLE "user_devices"
  ALTER COLUMN "platform" TYPE VARCHAR(20),
  ALTER COLUMN "device_id" TYPE VARCHAR(255);

DELETE FROM "user_devices" a
USING "user_devices" b
WHERE a.ctid < b.ctid AND a."push_token" = b."push_token";

CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_user_id_device_id_key"
  ON "user_devices"("user_id", "device_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_push_token_key"
  ON "user_devices"("push_token");
CREATE INDEX IF NOT EXISTS "user_devices_user_id_enabled_idx"
  ON "user_devices"("user_id", "enabled");
ALTER TABLE "user_devices"
  DROP CONSTRAINT IF EXISTS "user_devices_platform_check";
ALTER TABLE "user_devices"
  ADD CONSTRAINT "user_devices_platform_check"
    CHECK ("platform" IN ('ios', 'android', 'web'));

CREATE TABLE IF NOT EXISTS "qr_scans" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "qr_scans_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "qr_scans_item_id_created_at_idx"
  ON "qr_scans"("item_id", "created_at");

CREATE TABLE IF NOT EXISTS "security_audit_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "security_audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "security_audit_logs_user_id_created_at_idx"
  ON "security_audit_logs"("user_id", "created_at");

-- Bring the deployed notification table in line with the already public v1
-- contract without changing its existing rows.
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "delivery_status" TEXT NOT NULL DEFAULT 'SENT',
  ADD COLUMN IF NOT EXISTS "push_message_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_receiver_id_dedupe_key_key"
  ON "Notification"("receiver_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "Notification_delivery_status_idx"
  ON "Notification"("delivery_status");
