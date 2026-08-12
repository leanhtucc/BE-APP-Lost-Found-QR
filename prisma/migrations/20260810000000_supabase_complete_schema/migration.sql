-- Fresh Supabase baseline. This migration intentionally replaces the old
-- Neon migration history; no production data migration is expected.
CREATE SCHEMA IF NOT EXISTS "public";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "ItemStatus" AS ENUM ('SAFE', 'PENDING_PAYMENT', 'LOST', 'FOUND', 'RESOLVED');
CREATE TYPE "PostStatus" AS ENUM ('PENDING_PAYMENT', 'SEARCHING', 'FOUND', 'EXPIRED_REFUNDED', 'CANCELLED', 'RESOLVED');
CREATE TYPE "EscrowStatus" AS ENUM ('HOLDING', 'RELEASED', 'REFUNDED');
CREATE TYPE "PaymentProvider" AS ENUM ('VNPAY', 'MOMO');
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "NotificationCategory" AS ENUM ('IMPORTANT', 'TRANSACTION', 'ITEM', 'SOCIAL');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "uid" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "photoURL" TEXT,
  "pushToken" TEXT,
  "phoneNumber" TEXT,
  "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "totalReturned" INTEGER NOT NULL DEFAULT 0,
  "itemsLost" INTEGER NOT NULL DEFAULT 0,
  "addressCity" TEXT,
  "bio" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "privacySettings" JSONB DEFAULT '{}',
  "password" TEXT,
  "verificationCode" TEXT,
  "verificationCodeExpiry" TIMESTAMP(3),
  "googleId" TEXT,
  "resetPasswordExpiry" TIMESTAMP(3),
  "resetPasswordToken" TEXT,
  "lastLogin" TIMESTAMP(3),
  "role" TEXT NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "receiver_id" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Item" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "status" "ItemStatus" NOT NULL DEFAULT 'SAFE',
  "lostMessage" TEXT,
  "qrCodeUrl" TEXT,
  "securityToken" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "location_geohash" VARCHAR(16),
  "location" geography(Point,4326),
  "location_updated_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "imagePublicUrl" TEXT,
  "lastSeenLocation" TEXT,
  "securityPin" TEXT,
  "qr_code_id" TEXT NOT NULL,
  "details" JSONB,
  "has_insurance" BOOLEAN NOT NULL DEFAULT false,
  "lostLat" DOUBLE PRECISION,
  "lostLng" DOUBLE PRECISION,
  "lostAddress" TEXT,
  CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserLocation" (
  "user_id" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "Post" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "address" TEXT,
  "bounty_amount" INTEGER NOT NULL,
  "total_paid" INTEGER NOT NULL DEFAULT 0,
  "status" "PostStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "description" TEXT,
  "radar_config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EscrowTransaction" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "status" "EscrowStatus" NOT NULL DEFAULT 'HOLDING',
  "transaction_code" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiConversation" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiMessage" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" "AiMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX "User_uid_idx" ON "User"("uid");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_memberId_idx" ON "User"("memberId");
CREATE INDEX "User_googleId_idx" ON "User"("googleId");
CREATE INDEX "User_resetPasswordToken_idx" ON "User"("resetPasswordToken");

CREATE INDEX "Notification_receiver_id_created_at_idx" ON "Notification"("receiver_id", "created_at");
CREATE INDEX "Notification_receiver_id_is_read_idx" ON "Notification"("receiver_id", "is_read");
CREATE INDEX "Notification_category_idx" ON "Notification"("category");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

CREATE UNIQUE INDEX "Item_itemId_key" ON "Item"("itemId");
CREATE UNIQUE INDEX "Item_securityToken_key" ON "Item"("securityToken");
CREATE UNIQUE INDEX "Item_qr_code_id_key" ON "Item"("qr_code_id");
CREATE INDEX "Item_itemId_idx" ON "Item"("itemId");
CREATE INDEX "Item_ownerId_idx" ON "Item"("ownerId");
CREATE INDEX "Item_status_idx" ON "Item"("status");
CREATE INDEX "Item_lostLat_lostLng_idx" ON "Item"("lostLat", "lostLng");
CREATE INDEX "Item_location_geohash_idx" ON "Item"("location_geohash");
CREATE INDEX "Item_location_gist_idx" ON "Item" USING GIST ("location");

CREATE INDEX "UserLocation_lat_lng_idx" ON "UserLocation"("lat", "lng");
CREATE INDEX "Post_owner_id_idx" ON "Post"("owner_id");
CREATE INDEX "Post_item_id_idx" ON "Post"("item_id");
CREATE INDEX "Post_status_idx" ON "Post"("status");
CREATE INDEX "Post_lat_lng_idx" ON "Post"("lat", "lng");
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "EscrowTransaction_post_id_idx" ON "EscrowTransaction"("post_id");
CREATE INDEX "EscrowTransaction_status_idx" ON "EscrowTransaction"("status");
CREATE UNIQUE INDEX "EscrowTransaction_provider_transaction_code_key" ON "EscrowTransaction"("provider", "transaction_code");
CREATE INDEX "AiConversation_user_id_updated_at_idx" ON "AiConversation"("user_id", "updated_at");
CREATE INDEX "AiMessage_conversation_id_created_at_idx" ON "AiMessage"("conversation_id", "created_at");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_receiver_id_fkey"
  FOREIGN KEY ("receiver_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
