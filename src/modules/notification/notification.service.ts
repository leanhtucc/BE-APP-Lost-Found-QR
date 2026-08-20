import { Notification, NotificationCategory } from "../../generated/prisma/client";
import admin from "../../config/firebaseAdmin";
import { logger } from "../../libs/logger";
import { prisma } from "../../libs/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { emitInAppNotificationToUser } from "../../socket/radar.socket";
import { notificationPreferenceRepository } from "./notification.preference.repository";
import { NotificationRepository } from "./notification.repository";
import { userDeviceRepository } from "./user-device.repository";
import {
  CreateNotificationInput,
  EscrowLockedNotificationInput,
  MarkAllReadResponse,
  MatchFoundNotificationInput,
  MoneyNotificationInput,
  NewChatNotificationInput,
  NotificationDTO,
  NotificationListQuery,
  NotificationListResponse,
  NotificationPreferenceDTO,
  ProximityNotificationInput,
  RegisterDeviceInput,
  StatusUpdateNotificationInput,
  UpdatePreferenceInput,
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

  private formatNotification(notification: any): NotificationDTO {
    return {
      id: String(notification.id || ""),
      receiver_id: String(notification.receiverId || ""),
      category: notification.category,
      type: String(notification.type || ""),
      title: String(notification.title || ""),
      content: String(notification.content || ""),
      metadata: notification.metadata ?? null,
      is_read: Boolean(notification.isRead),
      dedupe_key: notification.dedupeKey ?? null,
      delivery_status: notification.deliveryStatus || "SENT",
      opened_at: notification.openedAt
        ? new Date(notification.openedAt).toISOString()
        : null,
      created_at: notification.createdAt
        ? new Date(notification.createdAt).toISOString()
        : new Date().toISOString(),
    };
  }

  private formatPreference(pref: any): NotificationPreferenceDTO {
    return {
      user_id: pref.userId,
      push_enabled: pref.pushEnabled,
      important_enabled: pref.importantEnabled,
      transaction_enabled: pref.transactionEnabled,
      item_enabled: pref.itemEnabled,
      social_enabled: pref.socialEnabled,
      daily_digest_enabled: pref.dailyDigestEnabled,
      nearby_alerts_enabled: pref.nearbyAlertsEnabled,
      quiet_hours_enabled: pref.quietHoursEnabled,
      quiet_start: pref.quietStart,
      quiet_end: pref.quietEnd,
      timezone: pref.timezone,
      daily_digest_time: pref.dailyDigestTime,
      nearby_radius: pref.nearbyRadius,
      created_at: pref.createdAt.toISOString(),
      updated_at: pref.updatedAt.toISOString(),
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

  /**
   * Check if current time falls within user's configured quiet hours.
   */
  private isWithinQuietHours(quietStart: string, quietEnd: string, now = new Date()): boolean {
    const startParts = quietStart.split(":").map(Number);
    const endParts = quietEnd.split(":").map(Number);
    const startH = startParts[0] ?? 0;
    const startM = startParts[1] ?? 0;
    const endH = endParts[0] ?? 0;
    const endM = endParts[1] ?? 0;

    if (isNaN(startH) || isNaN(endH)) return false;

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins < endMins) {
      return currentMins >= startMins && currentMins < endMins;
    }
    return currentMins >= startMins || currentMins < endMins;
  }

  /**
   * Multi-device FCM Push notification with quiet hours & invalid token cleanup.
   */
  private async sendPushNotification(
    receiverId: string,
    notification: NotificationDTO,
    priority: "normal" | "high",
    collapseKey?: string
  ): Promise<void> {
    if (!admin.apps.length) {
      return;
    }

    // 1. Check user notification preferences
    const pref = await notificationPreferenceRepository.findByUserId(receiverId);
    if (!pref.pushEnabled) {
      return;
    }

    // Check category level toggle
    let categoryEnabled = true;
    switch (notification.category) {
      case "IMPORTANT": categoryEnabled = pref.importantEnabled; break;
      case "TRANSACTION": categoryEnabled = pref.transactionEnabled; break;
      case "ITEM": categoryEnabled = pref.itemEnabled; break;
      case "SOCIAL": categoryEnabled = pref.socialEnabled; break;
    }

    if (!categoryEnabled) {
      return;
    }

    // Check quiet hours (IMPORTANT & TRANSACTION bypass quiet hours)
    if (
      pref.quietHoursEnabled &&
      notification.category !== "IMPORTANT" &&
      notification.category !== "TRANSACTION" &&
      this.isWithinQuietHours(pref.quietStart, pref.quietEnd)
    ) {
      logger.info(`[PushNotification] Skipped push for user=${receiverId} due to quiet hours (${pref.quietStart}-${pref.quietEnd})`);
      return;
    }

    // 2. Fetch active device push tokens
    let tokens = await userDeviceRepository.findActiveTokensByUserId(receiverId);

    // Fallback: check User.pushToken column for legacy clients
    if (!tokens.length) {
      const user = await prisma.user.findUnique({
        where: { id: receiverId },
        select: { pushToken: true },
      });
      if (user?.pushToken) {
        tokens = [user.pushToken];
      }
    }

    if (!tokens.length) {
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: notification.title,
          body: notification.content,
        },
        data: this.toFcmData(notification),
        android: {
          priority,
          ...(collapseKey && { collapseKey }),
        },
        apns: {
          headers: {
            "apns-priority": priority === "high" ? "10" : "5",
            ...(collapseKey && { "apns-collapse-id": collapseKey }),
          },
        },
      });

      // 3. Clean up invalid FCM tokens automatically
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            const token = tokens[idx];
            if (token) invalidTokens.push(token);
          }
        }
      });

      if (invalidTokens.length > 0) {
        logger.warn(`[PushNotification] Deactivating ${invalidTokens.length} invalid FCM token(s) for user=${receiverId}`);
        await userDeviceRepository.deactivateTokens(invalidTokens);
      }

      await this.repository.updateDeliveryStatus(notification.id, "SENT");
    } catch (error) {
      logger.error("Failed to send multicast push notification", error);
      await this.repository.updateDeliveryStatus(notification.id, "FAILED");
    }
  }

  async createNotification(
    input: CreateNotificationInput
  ): Promise<NotificationDTO | null> {
    const created = await this.repository.create({
      receiverId: input.receiverId,
      category: input.category,
      type: input.type,
      title: input.title,
      content: input.content,
      metadata: input.metadata,
      dedupeKey: input.dedupeKey,
    });

    if (!created) {
      return null;
    }

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

      // Fire-and-forget push notification to avoid blocking caller
      void this.sendPushNotification(
        input.receiverId,
        formatted,
        effectivePriority,
        input.collapseKey
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

    const { notifications, total, totalUnread } =
      await this.repository.findByReceiverId(receiverId, {
        category: query.category,
        skip,
        take: limit,
      });

    return {
      data: notifications.map((item) => this.formatNotification(item)),
      total_unread: totalUnread,
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

  async markNotificationAsOpened(
    receiverId: string,
    notificationId: string
  ): Promise<NotificationDTO> {
    const updated = await this.repository.markAsOpened(notificationId, receiverId);
    if (!updated) {
      throw new AppError("Notification not found", 404);
    }
    return this.formatNotification(updated);
  }

  async getUnreadCount(receiverId: string): Promise<number> {
    return this.repository.countUnread(receiverId);
  }

  async markAllAsRead(receiverId: string): Promise<MarkAllReadResponse> {
    const updatedCount = await this.repository.markAllAsRead(receiverId);
    return { updated_count: updatedCount };
  }

  // ─── Preferences & Devices ─────────────────────────────────────────

  async getPreferences(userId: string): Promise<NotificationPreferenceDTO> {
    const pref = await notificationPreferenceRepository.findByUserId(userId);
    return this.formatPreference(pref);
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferenceInput
  ): Promise<NotificationPreferenceDTO> {
    const updated = await notificationPreferenceRepository.upsert(userId, input);
    return this.formatPreference(updated);
  }

  async registerDevice(userId: string, input: RegisterDeviceInput) {
    const device = await userDeviceRepository.upsertDevice({
      userId,
      token: input.token,
      platform: input.platform || "android",
      deviceId: input.deviceId,
    });

    // Also sync User.pushToken for backward compatibility
    await prisma.user.update({
      where: { id: userId },
      data: { pushToken: input.token },
    }).catch(() => {/* ignore */});

    return {
      success: true,
      device_id: device.deviceId,
      platform: device.platform,
    };
  }

  async unregisterDevice(userId: string, deviceId: string) {
    const deleted = await userDeviceRepository.deleteByDeviceId(userId, deviceId);
    return { success: deleted };
  }

  // ─── Helper Builders for Application Events ──────────────────────────

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
      dedupeKey: `escrow:${input.transactionId}`,
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
      dedupeKey: `refund:${input.transactionId}`,
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
      dedupeKey: `bounty:${input.transactionId}`,
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
      collapseKey: `chat:${input.roomId}`,
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
      dedupeKey: input.dedupeKey,
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
        await userDeviceRepository.deleteOldInactiveDevices(60);

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
