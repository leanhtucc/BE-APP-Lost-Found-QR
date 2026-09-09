-- AlterTable
ALTER TABLE "Item"
  ADD COLUMN "capture_latitude" DOUBLE PRECISION,
  ADD COLUMN "capture_longitude" DOUBLE PRECISION,
  ADD COLUMN "capture_address" TEXT,
  ADD COLUMN "capture_accuracy_meters" DOUBLE PRECISION,
  ADD COLUMN "captured_at" TIMESTAMP(3);
