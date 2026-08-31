-- Guardian payment state machine. A pending payment never changes Item.status.

CREATE TYPE "GuardianReportStatus" AS ENUM (
  'PENDING_PAYMENT', 'ACTIVE', 'PAYMENT_FAILED', 'CANCELLED',
  'EXPIRED', 'FOUND', 'COMPLETED'
);

ALTER TABLE "Post" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Post"
  ALTER COLUMN "status" TYPE "GuardianReportStatus"
  USING (
    CASE "status"::text
      WHEN 'SEARCHING' THEN 'ACTIVE'
      WHEN 'EXPIRED_REFUNDED' THEN 'EXPIRED'
      WHEN 'RESOLVED' THEN 'COMPLETED'
      ELSE "status"::text
    END
  )::"GuardianReportStatus";
ALTER TABLE "Post" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
DROP TYPE "PostStatus";

-- Existing pending reports must not keep an item in an artificial pending state.
CREATE TYPE "ItemStatus_new" AS ENUM ('SAFE', 'LOST', 'FOUND', 'RESOLVED');
ALTER TABLE "Item" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Item"
  ALTER COLUMN "status" TYPE "ItemStatus_new"
  USING (CASE WHEN "status"::text = 'PENDING_PAYMENT' THEN 'SAFE' ELSE "status"::text END)::"ItemStatus_new";
ALTER TABLE "Item" ALTER COLUMN "status" SET DEFAULT 'SAFE';
DROP TYPE "ItemStatus";
ALTER TYPE "ItemStatus_new" RENAME TO "ItemStatus";

ALTER TABLE "Post"
  ADD COLUMN "normalized_address" TEXT,
  ADD COLUMN "radar_radius" INTEGER,
  ADD COLUMN "duration_hours" INTEGER,
  ADD COLUMN "service_fee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'VND',
  ADD COLUMN "activated_at" TIMESTAMP(3),
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "idempotency_key" TEXT;

-- Preserve the newest open report if legacy data contains duplicates, so the
-- safety index below can be created without discarding report history.
WITH ranked_open_reports AS (
  SELECT "id", row_number() OVER (PARTITION BY "item_id" ORDER BY "createdAt" DESC, "id" DESC) AS rank
  FROM "Post"
  WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE')
)
UPDATE "Post" AS report
SET "status" = 'CANCELLED'
FROM ranked_open_reports
WHERE report."id" = ranked_open_reports."id" AND ranked_open_reports.rank > 1;

CREATE UNIQUE INDEX "Post_idempotency_key_key"
  ON "Post"("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX "Post_one_open_report_per_item_idx"
  ON "Post"("item_id") WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE');

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED');
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "provider_order_id" TEXT NOT NULL,
  "provider_transaction_id" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "payment_url" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "paid_at" TIMESTAMP(3),
  "raw_callback" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_provider_order_id_key" ON "Payment"("provider_order_id");
CREATE UNIQUE INDEX "Payment_provider_transaction_id_key"
  ON "Payment"("provider_transaction_id") WHERE "provider_transaction_id" IS NOT NULL;
CREATE INDEX "Payment_report_id_status_idx" ON "Payment"("report_id", "status");
CREATE INDEX "Payment_expires_at_idx" ON "Payment"("expires_at");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
