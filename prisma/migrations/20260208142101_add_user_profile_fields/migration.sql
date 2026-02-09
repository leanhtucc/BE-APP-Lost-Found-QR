/*
  Warnings:

  - A unique constraint covering the columns `[memberId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - The required column `memberId` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "itemsLost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "memberId" TEXT NOT NULL,
ADD COLUMN     "privacySettings" JSONB DEFAULT '{}',
ADD COLUMN     "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 5.0;

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- CreateIndex
CREATE INDEX "User_memberId_idx" ON "User"("memberId");
