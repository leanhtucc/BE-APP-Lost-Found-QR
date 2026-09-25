-- Phase 4: a return session belongs to exactly one source.
ALTER TABLE "return_sessions" ALTER COLUMN "item_id" DROP NOT NULL;
ALTER TABLE "return_sessions" ADD COLUMN "found_report_id" TEXT;

ALTER TABLE "return_sessions"
  ADD CONSTRAINT "return_sessions_exactly_one_source_check"
  CHECK (
    ("item_id" IS NOT NULL AND "found_report_id" IS NULL)
    OR
    ("item_id" IS NULL AND "found_report_id" IS NOT NULL)
  );

CREATE INDEX "return_sessions_found_report_id_idx"
  ON "return_sessions"("found_report_id");

ALTER TABLE "return_sessions"
  ADD CONSTRAINT "return_sessions_found_report_id_fkey"
  FOREIGN KEY ("found_report_id") REFERENCES "FoundReport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "FoundReportClaimStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TABLE "found_report_claims" (
  "id" TEXT NOT NULL,
  "found_report_id" TEXT NOT NULL,
  "claimant_id" TEXT NOT NULL,
  "ownership_proof" TEXT NOT NULL,
  "status" "FoundReportClaimStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_id" TEXT,
  "return_session_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "found_report_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "found_report_claims_found_report_id_claimant_id_key"
  ON "found_report_claims"("found_report_id", "claimant_id");
CREATE UNIQUE INDEX "found_report_claims_return_session_id_key"
  ON "found_report_claims"("return_session_id");
CREATE UNIQUE INDEX "found_report_claims_one_accepted_per_report_idx"
  ON "found_report_claims"("found_report_id") WHERE "status" = 'ACCEPTED';
CREATE INDEX "found_report_claims_found_report_id_status_idx"
  ON "found_report_claims"("found_report_id", "status");
CREATE INDEX "found_report_claims_claimant_id_status_idx"
  ON "found_report_claims"("claimant_id", "status");

ALTER TABLE "found_report_claims"
  ADD CONSTRAINT "found_report_claims_found_report_id_fkey"
  FOREIGN KEY ("found_report_id") REFERENCES "FoundReport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "found_report_claims"
  ADD CONSTRAINT "found_report_claims_claimant_id_fkey"
  FOREIGN KEY ("claimant_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "found_report_claims"
  ADD CONSTRAINT "found_report_claims_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "found_report_claims"
  ADD CONSTRAINT "found_report_claims_return_session_id_fkey"
  FOREIGN KEY ("return_session_id") REFERENCES "return_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
