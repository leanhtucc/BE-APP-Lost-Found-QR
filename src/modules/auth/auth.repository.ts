import { prisma } from "../../libs/prisma";
import { ProfileStatistics } from "./auth.types";

/**
 * Auth Repository
 * Data access layer for users
 */

export class AuthRepository {
  async createUser(data: {
    uid: string;
    email: string;
    password: string;
    displayName: string;
    photoURL?: string;
    phoneNumber?: string;
    verificationCode?: string;
    verificationCodeExpiry?: Date;
    isVerified?: boolean;
    googleId?: string;
    bio?: string;
    addressCity?: string;
  }) {
    return prisma.user.create({
      data: {
        ...data,
        memberId: `USER_${data.uid.replace("user_", "")}`, // Generate memberId
      },
      select: {
        id: true,
        uid: true,
        memberId: true,
        email: true,
        displayName: true,
        photoURL: true,
        phoneNumber: true,
        trustScore: true,
        totalReturned: true,
        itemsLost: true,
        addressCity: true,
        bio: true,
        isVerified: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
        password: true,
        googleId: true,
        tokenVersion: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    return prisma.user.findFirst({
      where: { phoneNumber },
    });
  }

  async updateLastLogin(id: string) {
    return prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  async findByGoogleId(googleId: string) {
    return prisma.user.findUnique({
      where: { googleId },
    });
  }

  async findByUid(uid: string) {
    return prisma.user.findUnique({
      where: { uid },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        uid: true,
        memberId: true,
        email: true,
        displayName: true,
        photoURL: true,
        phoneNumber: true,
        trustScore: true,
        totalReturned: true,
        itemsLost: true,
        addressCity: true,
        bio: true,
        isVerified: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
        password: true,
        googleId: true,
        scheduledDeletionAt: true,
        tokenValidAfter: true,
        tokenVersion: true,
      },
    });
  }

  async findProfileById(
    id: string
  ): Promise<{ user: any; statistics: ProfileStatistics } | null> {
    const [
      user,
      protectedItems,
      safeItems,
      lostItems,
      activeLostReports,
      qrScans,
    ] = await prisma.$transaction([
      prisma.user.findUnique({
        where: { id },
        include: { notificationPreference: true },
      }),
      prisma.item.count({ where: { ownerId: id } }),
      prisma.item.count({ where: { ownerId: id, status: "SAFE" } }),
      prisma.item.count({
        where: {
          ownerId: id,
          OR: [{ status: "LOST" }, { posts: { some: { status: "ACTIVE" } } }],
        },
      }),
      prisma.post.count({ where: { ownerId: id, status: "ACTIVE" } }),
      prisma.qrScan.count({ where: { item: { ownerId: id } } }),
    ]);

    if (!user) return null;

    return {
      user,
      statistics: {
        protectedItems,
        safeItems,
        lostItems,
        activeLostReports,
        completedReturns: user.totalReturned,
        qrScans,
      },
    };
  }

  async findPhoneOwner(phoneNumber: string, excludeUserId?: string) {
    return prisma.user.findFirst({
      where: {
        phoneNumber,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
  }

  async updateUser(
    id: string,
    data: {
      displayName?: string;
      photoURL?: string | null;
      phoneNumber?: string | null;
      pushToken?: string;
      bio?: string | null;
      addressCity?: string | null;
      privacySettings?: object;
      isVerified?: boolean;
      googleId?: string;
      resetPasswordToken?: string | null;
      resetPasswordExpiry?: Date | null;
    }
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        uid: true,
        memberId: true,
        email: true,
        displayName: true,
        photoURL: true,
        phoneNumber: true,
        trustScore: true,
        totalReturned: true,
        itemsLost: true,
        addressCity: true,
        bio: true,
        isVerified: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
        password: true,
        googleId: true,
      },
    });
  }

  async createAuditLog(
    userId: string,
    action: string,
    metadata?: Record<string, unknown>
  ) {
    return prisma.securityAuditLog.create({
      data: { userId, action, metadata: metadata as any },
    });
  }

  async scheduleAccountDeletion(userId: string, scheduledDeletionAt: Date) {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          deletionRequestedAt: now,
          scheduledDeletionAt,
          tokenValidAfter: now,
          tokenVersion: { increment: 1 },
          pushToken: null,
        },
      });
      await tx.userDevice.updateMany({
        where: { userId },
        data: { isActive: false },
      });
      await tx.notificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          pushEnabled: false,
          emailEnabled: false,
          proximityEnabled: false,
        },
        update: {
          pushEnabled: false,
          emailEnabled: false,
          proximityEnabled: false,
          nearbyAlertsEnabled: false,
        },
      });
      await tx.$executeRaw`
        UPDATE "Item"
        SET
          "qr_code_id" = 'deleted_' || "id",
          "securityToken" = 'deleted_' || "id",
          "qrCodeUrl" = NULL,
          "status" = 'RESOLVED',
          "updatedAt" = NOW()
        WHERE "ownerId" = ${userId}
      `;
      await tx.securityAuditLog.create({
        data: {
          userId,
          action: "ACCOUNT_DELETION_SCHEDULED",
          metadata: { scheduledDeletionAt: scheduledDeletionAt.toISOString() },
        },
      });
    });
  }

  async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async countByEmail(email: string) {
    return prisma.user.count({
      where: { email },
    });
  }

  async findByResetToken(token: string) {
    return prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: {
          gt: new Date(), // Token chưa hết hạn
        },
      },
    });
  }

  async updatePassword(
    id: string,
    hashedPassword: string,
    revokeTokens = false
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpiry: null,
          ...(revokeTokens ? { tokenValidAfter: new Date() } : {}),
          ...(revokeTokens ? { tokenVersion: { increment: 1 } } : {}),
        },
      });

      if (revokeTokens) {
        await tx.securityAuditLog.create({
          data: { userId: id, action: "PASSWORD_CHANGED" },
        });
      }

      return updated;
    });
  }

  async revokeTokens(id: string, action = "LOGOUT") {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          tokenValidAfter: new Date(),
          tokenVersion: { increment: 1 },
        },
      });

      await tx.securityAuditLog.create({
        data: { userId: id, action },
      });

      return user;
    });
  }
}
