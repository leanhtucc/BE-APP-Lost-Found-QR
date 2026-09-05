-- CreateEnum
CREATE TYPE "ReturnSessionStatus" AS ENUM ('CHAT_ACTIVE', 'MEETUP_PROPOSED', 'MEETUP_ACCEPTED', 'TRACKING_ACTIVE', 'ARRIVAL_PENDING', 'HANDOVER_PENDING', 'HANDOVER_CONFIRMED', 'REWARD_RELEASING', 'REWARD_PAID', 'RATING_PENDING', 'COMPLETED', 'MEETUP_CANCELLED', 'TRACKING_EXPIRED', 'HANDOVER_DISPUTED', 'PAYOUT_FAILED', 'REFUND_PENDING');

-- CreateEnum
CREATE TYPE "ReturnUserRole" AS ENUM ('OWNER', 'FINDER');

-- CreateEnum
CREATE TYPE "MeetupStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RewardPayoutStatus" AS ENUM ('PROCESSING', 'PAID', 'FAILED', 'ACTION_REQUIRED');

-- CreateTable
CREATE TABLE "return_sessions" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "report_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "finder_id" TEXT NOT NULL,
    "status" "ReturnSessionStatus" NOT NULL DEFAULT 'CHAT_ACTIVE',
    "server_revision" INTEGER NOT NULL DEFAULT 1,
    "tracking_started_at" TIMESTAMP(3),
    "tracking_expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_meetup_proposals" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "proposed_by" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "scheduled_time" TEXT NOT NULL,
    "notes" TEXT,
    "status" "MeetupStatus" NOT NULL DEFAULT 'PENDING',
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "return_meetup_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_arrivals" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "role" "ReturnUserRole" NOT NULL,
    "declared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "distance_meters" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,

    CONSTRAINT "return_arrivals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_challenges" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "consumed_at" TIMESTAMP(3),
    "created_for_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_confirmations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "role" "ReturnUserRole" NOT NULL,
    "verification_method" TEXT NOT NULL DEFAULT 'CODE',
    "idempotency_key" TEXT,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_payouts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "report_id" TEXT,
    "escrow_transaction_id" TEXT,
    "base_amount" INTEGER NOT NULL,
    "platform_fee" INTEGER NOT NULL DEFAULT 0,
    "net_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "RewardPayoutStatus" NOT NULL DEFAULT 'PROCESSING',
    "payout_method_masked" TEXT,
    "transaction_id" TEXT,
    "failure_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finder_ratings" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "rater_id" TEXT NOT NULL,
    "finder_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finder_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_sessions_channel_id_key" ON "return_sessions"("channel_id");

-- CreateIndex
CREATE INDEX "return_sessions_channel_id_idx" ON "return_sessions"("channel_id");

-- CreateIndex
CREATE INDEX "return_sessions_item_id_idx" ON "return_sessions"("item_id");

-- CreateIndex
CREATE INDEX "return_sessions_owner_id_idx" ON "return_sessions"("owner_id");

-- CreateIndex
CREATE INDEX "return_sessions_finder_id_idx" ON "return_sessions"("finder_id");

-- CreateIndex
CREATE INDEX "return_sessions_status_idx" ON "return_sessions"("status");

-- CreateIndex
CREATE INDEX "return_meetup_proposals_session_id_status_idx" ON "return_meetup_proposals"("session_id", "status");

-- CreateIndex
CREATE INDEX "return_arrivals_session_id_idx" ON "return_arrivals"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_arrivals_session_id_participant_id_key" ON "return_arrivals"("session_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "handover_challenges_session_id_key" ON "handover_challenges"("session_id");

-- CreateIndex
CREATE INDEX "handover_confirmations_session_id_idx" ON "handover_confirmations"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "handover_confirmations_session_id_participant_id_key" ON "handover_confirmations"("session_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_payouts_session_id_key" ON "reward_payouts"("session_id");

-- CreateIndex
CREATE INDEX "reward_payouts_status_idx" ON "reward_payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "finder_ratings_session_id_key" ON "finder_ratings"("session_id");

-- CreateIndex
CREATE INDEX "finder_ratings_finder_id_idx" ON "finder_ratings"("finder_id");

-- AddForeignKey
ALTER TABLE "return_sessions" ADD CONSTRAINT "return_sessions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_sessions" ADD CONSTRAINT "return_sessions_finder_id_fkey" FOREIGN KEY ("finder_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_sessions" ADD CONSTRAINT "return_sessions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_sessions" ADD CONSTRAINT "return_sessions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_meetup_proposals" ADD CONSTRAINT "return_meetup_proposals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "return_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_arrivals" ADD CONSTRAINT "return_arrivals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "return_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_challenges" ADD CONSTRAINT "handover_challenges_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "return_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_confirmations" ADD CONSTRAINT "handover_confirmations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "return_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_payouts" ADD CONSTRAINT "reward_payouts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "return_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finder_ratings" ADD CONSTRAINT "finder_ratings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "return_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finder_ratings" ADD CONSTRAINT "finder_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finder_ratings" ADD CONSTRAINT "finder_ratings_finder_id_fkey" FOREIGN KEY ("finder_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
