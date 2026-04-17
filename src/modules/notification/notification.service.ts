import { Notification } from "@prisma/client";
import admin from "../../config/firebaseAdmin";
import { logger } from "../../libs/logger";
import { prisma } from "../../libs/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { emitInAppNotificationToUser } from "../../socket/radar.socket";
import { NotificationRepository } from "./notification.repository";
import {
  CreateNotificationInput,
  EscrowLockedNotificationInput,
  MatchFoundNotificationInput,
  MoneyNotificationInput,
  NewChatNotificationInput,
  NotificationDTO,
  NotificationListQuery,
  NotificationListResponse,
  ProximityNotificationInput,
  StatusUpdateNotificationInput,
} from "./notification.types";

const SOCIAL_NOTIFICATION_RETENTION_DAYS = 30;

export class NotificationService {
  private readonly repository = new NotificationRepository();
  private cleanupTimer: NodeJS.Timeout | null = null;

  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }

    return `${(meters / 1000).toFixed(1)}km`;
  }

  private formatNotification(notification: Notification): NotificationDTO {
    return {
      id: notification.id,
      receiver_id: notification.receiverId,
      category: notification.category,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      metadata: notification.metadata,
      is_read: notification.isRead,
      created_at: notification.createdAt.toISOString(),
    };
  }

  private toFcmData(notification: NotificationDTO): Record<string, string> {
    return {
      id: notification.id,
      receiver_id: notification.receiver_id,
      category: notification.category,
      type: notification.type,
      is_read: String(notification.is_read),
      created_at: notification.created_at,
      metadata: JSON.stringify(notification.metadata || {}),
    };
  }

  private async sendPushNotification(
    receiverId: string,
    notification: NotificationDTO,
    priority: "normal" | "high"
  ): Promise<void> {
    if (!admin.apps.length) {
      return;
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { pushToken: true },
    });

    if (!receiver?.pushToken) {
      return;
    }

    try {
      await admin.messaging().send({
        token: receiver.pushToken,
        notification: {
          title: notification.title,
          body: notification.content,
        },
        data: this.toFcmData(notification),
        android: {
          priority,
        },
        apns: {
          headers: {
            "apns-priority": priority === "high" ? "10" : "5",
          },
        },
      });
    } catch (error) {
      logger.error("Failed to send push notification", error);
    }
  }

  async createNotification(
    input: CreateNotificationInput
  ): Promise<NotificationDTO> {
    const created = await this.repository.create({
      receiverId: input.receiverId,
      category: input.category,
      type: input.type,
      title: input.title,
      content: input.content,
      metadata: input.metadata,
    });

    const formatted = this.formatNotification(created);
    const shouldEmitRealtime = input.emitRealtime !== false;
    const shouldSendPush = input.sendPush !== false;

    if (shouldEmitRealtime) {
      emitInAppNotificationToUser(input.receiverId, formatted);
    }

    if (shouldSendPush) {
      const effectivePriority =
        input.pushPriority ||
        (input.category === "IMPORTANT" || input.category === "TRANSACTION"
          ? "high"
          : "normal");

      await this.sendPushNotification(
        input.receiverId,
        formatted,
        effectivePriority
      );
    }

    return formatted;
  }

  async getNotifications(
    receiverId: string,
    query: NotificationListQuery
  ): Promise<NotificationListResponse> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const { notifications, total } = await this.repository.findByReceiverId(
      receiverId,
      {
        category: query.category,
        skip,
        take: limit,
      }
    );

    return {
      notifications: notifications.map((item) => this.formatNotification(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: skip + notifications.length < total,
      },
    };
  }

  async markNotificationAsRead(
    receiverId: string,
    notificationId: string
  ): Promise<NotificationDTO> {
    const existing = await this.repository.findByIdForReceiver(
      notificationId,
      receiverId
    );

    if (!existing) {
      throw new AppError("Notification not found", 404);
    }

    if (existing.isRead) {
      return this.formatNotification(existing);
    }

    const updated = await this.repository.markAsRead(notificationId);
    return this.formatNotification(updated);
  }

  async getUnreadCount(receiverId: string): Promise<number> {
    return this.repository.countUnread(receiverId);
  }

  async notifyEscrowLocked(input: EscrowLockedNotificationInput) {
    return this.createNotification({
      receiverId: input.receiverId,
      category: "TRANSACTION",
      type: "ESCROW_LOCKED",
      title: "Giao dịch an toàn",
      content: `${input.amount.toLocaleString("vi-VN")}đ đã được khóa trong escrow`,
      metadata: {
        amount: input.amount,
        transaction_id: input.transactionId,
        status: "locked",
        post_id: input.postId,
      },
      pushPriority: "high",
    });
  }

  async notifyPaymentRefunded(input: MoneyNotificationInput) {
    return this.createNotification({
      receiverId: input.receiverId,
      category: "TRANSACTION",
      type: "REFUNDED",
      title: "Hoàn tiền thành công",
      content: `${input.amount.toLocaleString("vi-VN")}đ đã được hoàn về ví của bạn`,
      metadata: {
        amount: input.amount,
        transaction_id: input.transactionId,
        status: input.status,
        post_id: input.postId,
      },
      pushPriority: "high",
    });
  }

  async notifyBountyReleased(input: MoneyNotificationInput) {
    return this.createNotification({
      receiverId: input.receiverId,
      category: "TRANSACTION",
      type: "RELEASED",
      title: "Nhận thưởng thành công",
      content: `${input.amount.toLocaleString("vi-VN")}đ đã được chuyển đến ví của bạn`,
      metadata: {
        amount: input.amount,
        transaction_id: input.transactionId,
        status: input.status,
        post_id: input.postId,
      },
      pushPriority: "high",
    });
  }

  async notifyMatchFound(input: MatchFoundNotificationInput) {
    const distance = this.formatDistance(input.distanceMeters);

    return this.createNotification({
      receiverId: input.receiverId,
      category: "IMPORTANT",
      type: "MATCH_FOUND",
      title: "Tìm thấy tín hiệu phù hợp",
      content: `${input.itemName} có người báo tìm thấy trong bán kính ${distance}`,
      metadata: {
        distance,
        post_id: input.postId,
        item_name: input.itemName,
      },
      pushPriority: "high",
    });
  }

  async notifyProximityAlert(input: ProximityNotificationInput) {
    const distance = this.formatDistance(input.distanceMeters);

    return this.createNotification({
      receiverId: input.receiverId,
      category: "IMPORTANT",
      type: "PROXIMITY",
      title: "Bạn đang rất gần nhau",
      content: `Khoảng cách hiện tại chỉ còn ${distance}`,
      metadata: {
        distance,
        post_id: input.postId,
      },
      pushPriority: "high",
    });
  }

  async notifyNewChat(input: NewChatNotificationInput) {
    return this.createNotification({
      receiverId: input.receiverId,
      category: "SOCIAL",
      type: "NEW_CHAT",
      title: "Tin nhắn mới",
      content: input.messagePreview,
      metadata: {
        sender_avatar: input.senderAvatar || "",
        room_id: input.roomId,
        message_preview: input.messagePreview,
        item_id: input.itemId,
      },
      pushPriority: "normal",
    });
  }

  async notifyStatusUpdate(input: StatusUpdateNotificationInput) {
    return this.createNotification({
      receiverId: input.receiverId,
      category: input.category,
      type: input.type,
      title: input.title,
      content: input.content,
      metadata: input.metadata,
    });
  }

  async cleanupOldNonCriticalNotifications(): Promise<number> {
    return this.repository.deleteOldSocialAndItemNotifications(
      SOCIAL_NOTIFICATION_RETENTION_DAYS
    );
  }

  startCleanupJob(): void {
    if (this.cleanupTimer) {
      return;
    }

    const executeCleanup = async () => {
      try {
        const deletedCount = await this.cleanupOldNonCriticalNotifications();

        if (deletedCount > 0) {
          logger.info("Old notifications cleaned up", { deletedCount });
        }
      } catch (error) {
        logger.error("Failed to cleanup old notifications", error);
      }
    };

    void executeCleanup();

    this.cleanupTimer = setInterval(
      () => {
        void executeCleanup();
      },
      12 * 60 * 60 * 1000
    );
  }

  stopCleanupJob(): void {
    if (!this.cleanupTimer) {
      return;
    }

    clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }
}

export const notificationService = new NotificationService();
