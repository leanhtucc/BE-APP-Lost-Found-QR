import { NotificationCategory, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../libs/prisma";

export class NotificationRepository {
  async create(data: {
    receiverId: string;
    category: NotificationCategory;
    type: string;
    title: string;
    content: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.notification.create({
      data,
    });
  }

  async findByReceiverId(
    receiverId: string,
    options: {
      category?: NotificationCategory;
      skip: number;
      take: number;
    }
  ) {
    const where: {
      receiverId: string;
      category?: NotificationCategory;
    } = {
      receiverId,
    };

    if (options.category) {
      where.category = options.category;
    }

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
        where: { receiverId, isRead: false },
      }),
    ]);

    return { notifications, total, totalUnread };
  }

  async findByIdForReceiver(id: string, receiverId: string) {
    return prisma.notification.findFirst({
      where: {
        id,
        receiverId,
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

  async markAllAsRead(receiverId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        receiverId,
        isRead: false,
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
