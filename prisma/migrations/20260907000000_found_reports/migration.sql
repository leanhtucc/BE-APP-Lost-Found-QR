CREATE TABLE "FoundReport" (
  "id" TEXT NOT NULL,
  "finderId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "imagePublicUrl" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "address" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FoundReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FoundReport_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "FoundReport_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "FoundReport_finderId_fkey" FOREIGN KEY ("finderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FoundReport_finderId_idempotencyKey_key" ON "FoundReport"("finderId", "idempotencyKey");
CREATE INDEX "FoundReport_resolvedAt_createdAt_idx" ON "FoundReport"("resolvedAt", "createdAt");
CREATE INDEX "FoundReport_lat_lng_idx" ON "FoundReport"("lat", "lng");
