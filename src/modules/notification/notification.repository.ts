import { NotificationCategory, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../libs/prisma";
import { logger } from "../../libs/logger";

export class NotificationRepository {
  async create(data: {
    receiverId: string;
    category: NotificationCategory;
    type: string;
    title: string;
    titleEn: string;
    content: string;
    contentEn: string;
    attachment?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    metadata?: Prisma.InputJsonValue;
    dedupeKey?: string;
    scheduledAt?: Date;
    sentAt?: Date;
    deliveryStatus?: string;
  }) {
    try {
      return await prisma.notification.create({
        data,
      });
    } catch (error: any) {
      // Prisma P2002: Unique constraint failed (receiverId, dedupeKey)
      if (error?.code === "P2002" && data.dedupeKey) {
        logger.info(
          `[NotificationRepo] Deduplicated notification for receiver=${data.receiverId}, dedupeKey=${data.dedupeKey}`
        );
        return null;
      }
      throw error;
    }
  }

  async findByReceiverId(
    receiverId: string,
    options: {
      skip: number;
      take: number;
      isRead?: boolean;
    }
  ) {
    const where: {
      receiverId: string;
      deletedAt: null;
      isRead?: boolean;
    } = {
      receiverId,
      deletedAt: null,
    };

    if (options.isRead !== undefined) {
      where.isRead = options.isRead;
    }

    try {
      const [notifications, total, totalUnread] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          skip: options.skip,
          take: options.take,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: { receiverId, isRead: false, deletedAt: null },
        }),
      ]);

      return { notifications, total, totalUnread };
    } catch (error: any) {
      logger.error("[NotificationRepo] Error fetching notifications:", error);
      return { notifications: [], total: 0, totalUnread: 0 };
    }
  }

  async findByIdForReceiver(id: string, receiverId: string) {
    return prisma.notification.findFirst({
      where: {
        id,
        receiverId,
        deletedAt: null,
      },
    });
  }

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
      },
    });
  }

  async markAsOpened(id: string, receiverId: string) {
    const notification = await this.findByIdForReceiver(id, receiverId);
    if (!notification) return null;

    return prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        openedAt: new Date(),
        deliveryStatus: "OPENED",
      },
    });
  }

  async updateDeliveryStatus(
    id: string,
    deliveryStatus: string,
    pushMessageId?: string
  ) {
    return prisma.notification.update({
      where: { id },
      data: {
        deliveryStatus,
        sentAt: new Date(),
        ...(pushMessageId && { pushMessageId }),
      },
    });
  }

  async markAllAsRead(receiverId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        receiverId,
        isRead: false,
        deletedAt: null,
      },
      data: {
        isRead: true,
      },
    });

    return result.count;
  }

  async countUnread(receiverId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        receiverId,
        isRead: false,
        deletedAt: null,
      },
    });
  }

  async deleteOldSocialAndItemNotifications(days: number): Promise<number> {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.notification.deleteMany({
      where: {
        category: {
          in: ["SOCIAL", "ITEM"],
        },
        createdAt: {
          lt: threshold,
        },
      },
    });

    return result.count;
  }
}

export const notificationRepository = new NotificationRepository();
