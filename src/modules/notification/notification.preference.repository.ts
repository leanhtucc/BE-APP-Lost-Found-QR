import { NotificationPreference } from "../../generated/prisma/client";
import { prisma } from "../../libs/prisma";
import { UpdatePreferenceInput } from "./notification.types";

export class NotificationPreferenceRepository {
  /**
   * Find notification preference by userId.
   * If not exists, creates a default preference record.
   */
  async findByUserId(userId: string): Promise<NotificationPreference> {
    const existing = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return prisma.notificationPreference.create({
      data: {
        userId,
      },
    });
  }

  /**
   * Upsert notification preference for a user.
   */
  async upsert(
    userId: string,
    data: UpdatePreferenceInput
  ): Promise<NotificationPreference> {
    return prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: {
        ...data,
      },
    });
  }

  /**
   * Get all users who have daily digest enabled and match digest time / timezone window.
   */
  async findEligibleUsersForDigest(
    currentTimeHHmm: string
  ): Promise<NotificationPreference[]> {
    return prisma.notificationPreference.findMany({
      where: {
        pushEnabled: true,
        dailyDigestEnabled: true,
        dailyDigestTime: currentTimeHHmm,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });
  }
}

export const notificationPreferenceRepository =
  new NotificationPreferenceRepository();
