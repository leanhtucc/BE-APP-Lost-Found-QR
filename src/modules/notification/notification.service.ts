import { createHash } from "crypto";
import { NotificationCategory } from "../../generated/prisma/client";
import admin from "../../config/firebaseAdmin";
import { logger } from "../../libs/logger";
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
  UserDeviceDTO,
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
      _id: String(notification.id || ""),
      type: String(notification.type || ""),
      title: {
        vi: String(notification.title || ""),
        en: String(notification.titleEn || notification.title || ""),
      },
      content: {
        vi: String(notification.content || ""),
        en: String(notification.contentEn || notification.content || ""),
      },
      attachment: String(notification.attachment || ""),
      status: notification.isRead ? "VIEW" : "UN_VIEW",
      user_id: String(notification.receiverId || ""),
      entity_type: notification.entityType ?? null,
      entity_id: notification.entityId ?? null,
      action: notification.action ?? null,
      deleted_at: notification.deletedAt
        ? new Date(notification.deletedAt).toISOString()
        : null,
      created_at: notification.createdAt
        ? new Date(notification.createdAt).toISOString()
        : new Date().toISOString(),
      updated_at: notification.updatedAt
        ? new Date(notification.updatedAt).toISOString()
        : new Date().toISOString(),
    };
  }

  private formatDevice(device: any): UserDeviceDTO {
    return {
      _id: String(device.id),
      platform: device.platform,
      device_id: device.deviceId,
      device_name: device.deviceName ?? null,
      app_version: device.appVersion ?? null,
      last_active_at: device.lastActiveAt.toISOString(),
      is_active: device.isActive,
      created_at: device.createdAt.toISOString(),
      updated_at: device.updatedAt.toISOString(),
    };
  }

  private normalizeLocalized(value: CreateNotificationInput["title"]) {
    return typeof value === "string" ? { vi: value, en: value } : value;
  }

  private formatPreference(pref: any): NotificationPreferenceDTO {
    return {
      user_id: pref.userId,
      push_enabled: pref.pushEnabled,
      email_enabled: pref.emailEnabled,
      proximity_enabled: pref.proximityEnabled,
      notification_radius_meters: pref.notificationRadiusMeters,
      language: pref.language,
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
      notification_id: notification._id,
      type: notification.type,
      entity_type: notification.entity_type || "",
      entity_id: notification.entity_id || "",
      action: notification.action || "",
    };
  }

  /**
   * Check if current time falls within user's configured quiet hours.
   */
  private isWithinQuietHours(
    quietStart: string,
    quietEnd: string,
    now = new Date()
  ): boolean {
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
    category: NotificationCategory,
    priority: "normal" | "high",
    collapseKey?: string
  ): Promise<void> {
    if (!admin.apps.length) {
      return;
    }

    // 1. Check user notification preferences
    const pref =
      await notificationPreferenceRepository.findByUserId(receiverId);
    if (!pref.pushEnabled) {
      return;
    }

    // Check category level toggle
    let categoryEnabled = true;
    switch (category) {
      case "IMPORTANT":
        categoryEnabled = pref.importantEnabled;
        break;
      case "TRANSACTION":
        categoryEnabled = pref.transactionEnabled;
        break;
      case "ITEM":
        categoryEnabled = pref.itemEnabled;
        break;
      case "SOCIAL":
        categoryEnabled = pref.socialEnabled;
        break;
    }

    if (!categoryEnabled) {
      return;
    }

    // Check quiet hours (IMPORTANT & TRANSACTION bypass quiet hours)
    if (
      pref.quietHoursEnabled &&
      category !== "IMPORTANT" &&
      category !== "TRANSACTION" &&
      this.isWithinQuietHours(pref.quietStart, pref.quietEnd)
    ) {
      logger.info(
        `[PushNotification] Skipped push for user=${receiverId} due to quiet hours (${pref.quietStart}-${pref.quietEnd})`
      );
      return;
    }

    // 2. Fetch active device push tokens
    const tokens =
      await userDeviceRepository.findActiveTokensByUserId(receiverId);

    if (!tokens.length) {
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title:
            pref.language === "en"
              ? notification.title.en
              : notification.title.vi,
          body:
            pref.language === "en"
              ? notification.content.en
              : notification.content.vi,
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
        logger.warn(
          `[PushNotification] Deactivating ${invalidTokens.length} invalid FCM token(s) for user=${receiverId}`
        );
        await userDeviceRepository.deactivateTokens(invalidTokens);
      }

      await this.repository.updateDeliveryStatus(notification._id, "SENT");
    } catch (error) {
      logger.error("Failed to send multicast push notification", error);
      await this.repository.updateDeliveryStatus(notification._id, "FAILED");
    }
  }

  async createNotification(
    input: CreateNotificationInput
  ): Promise<NotificationDTO | null> {
    if (input.type === "PROXIMITY") {
      const pref = await notificationPreferenceRepository.findByUserId(
        input.receiverId
      );
      if (!pref.proximityEnabled) {
        return null;
      }
    }

    const title = this.normalizeLocalized(input.title);
    const content = this.normalizeLocalized(input.content);
    const created = await this.repository.create({
      receiverId: input.receiverId,
      category: input.category,
      type: input.type,
      title: title.vi,
      titleEn: title.en,
      content: content.vi,
      contentEn: content.en,
      attachment: input.attachment,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
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
        input.category,
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
    const perPage = query.perPage || 10;
    const skip = (page - 1) * perPage;

    const { notifications, total, totalUnread } =
      await this.repository.findByReceiverId(receiverId, {
        skip,
        take: perPage,
        isRead:
          query.status === undefined ? undefined : query.status === "VIEW",
      });

    return {
      total_unread: totalUnread,
      total,
      page,
      per_page: perPage,
      items: notifications.map((item) => this.formatNotification(item)),
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
    const updated = await this.repository.markAsOpened(
      notificationId,
      receiverId
    );
    if (!updated) {
      throw new AppError("Notification not found", 404);
    }
    return this.formatNotification(updated);
  }

  async markNotificationAsViewed(receiverId: string, notificationId: string) {
    const notification = await this.markNotificationAsOpened(
      receiverId,
      notificationId
    );
    return {
      _id: notification._id,
      status: notification.status,
      updated_at: notification.updated_at,
    };
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

  async getProfilePreferences(userId: string) {
    const preference = await this.getPreferences(userId);
    return {
      pushEnabled: preference.push_enabled,
      emailEnabled: preference.email_enabled,
      proximityEnabled: preference.proximity_enabled,
      notificationRadiusMeters: preference.notification_radius_meters,
      language: preference.language,
      updatedAt: preference.updated_at,
    };
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferenceInput
  ): Promise<NotificationPreferenceDTO> {
    const normalized: UpdatePreferenceInput = { ...input };

    if (input.notificationRadiusMeters !== undefined) {
      normalized.nearbyRadius = input.notificationRadiusMeters;
    } else if (input.nearbyRadius !== undefined) {
      normalized.notificationRadiusMeters = input.nearbyRadius;
    }

    if (input.proximityEnabled !== undefined) {
      normalized.nearbyAlertsEnabled = input.proximityEnabled;
    } else if (input.nearbyAlertsEnabled !== undefined) {
      normalized.proximityEnabled = input.nearbyAlertsEnabled;
    }

    const updated = await notificationPreferenceRepository.upsert(
      userId,
      normalized
    );
    return this.formatPreference(updated);
  }

  async updateProfilePreferences(userId: string, input: UpdatePreferenceInput) {
    await this.updatePreferences(userId, input);
    return this.getProfilePreferences(userId);
  }

  async registerDevice(userId: string, input: RegisterDeviceInput) {
    const deviceId =
      input.deviceId ||
      `fcm-${createHash("sha256").update(input.token).digest("hex").slice(0, 32)}`;
    const device = await userDeviceRepository.upsertDevice({
      userId,
      token: input.token,
      platform: input.platform,
      deviceId,
      deviceName: input.deviceName,
      appVersion: input.appVersion,
    });

    return this.formatDevice(device);
  }

  async getUserDevices(userId: string): Promise<UserDeviceDTO[]> {
    return (await userDeviceRepository.findByUserId(userId)).map((device) =>
      this.formatDevice(device)
    );
  }

  async unregisterDeviceById(userId: string, id: string): Promise<void> {
    const deactivated = await userDeviceRepository.deactivateById(userId, id);
    if (!deactivated) throw new AppError("Device not found", 404);
  }

  // ─── Helper Builders for Application Events ──────────────────────────

  async notifyEscrowLocked(input: EscrowLockedNotificationInput) {
    return this.createNotification({
      receiverId: input.receiverId,
      category: "TRANSACTION",
      type: "ESCROW_LOCKED",
      title: { vi: "Giao dịch an toàn", en: "Secure transaction" },
      content: {
        vi: `${input.amount.toLocaleString("vi-VN")}đ đã được khóa trong escrow`,
        en: "Your reward funds are secured for the return.",
      },
      entityType: "ITEM",
      entityId: input.postId,
      action: "OPEN_ITEM",
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
      title: { vi: "Hoàn tiền thành công", en: "Refund completed" },
      content: {
        vi: `${input.amount.toLocaleString("vi-VN")}đ đã được hoàn về ví của bạn`,
        en: "The refund has been returned to your wallet.",
      },
      entityType: input.postId ? "ITEM" : undefined,
      entityId: input.postId,
      action: input.postId ? "OPEN_ITEM" : undefined,
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
      title: { vi: "Nhận thưởng thành công", en: "Reward received" },
      content: {
        vi: `${input.amount.toLocaleString("vi-VN")}đ đã được chuyển đến ví của bạn`,
        en: "The reward has been transferred to your wallet.",
      },
      entityType: input.postId ? "ITEM" : undefined,
      entityId: input.postId,
      action: input.postId ? "OPEN_ITEM" : undefined,
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
      title: { vi: "Tìm thấy tín hiệu phù hợp", en: "Possible match found" },
      content: {
        vi: `${input.itemName} có người báo tìm thấy trong bán kính ${distance}`,
        en: `A possible match for ${input.itemName} was reported nearby.`,
      },
      entityType: "ITEM",
      entityId: input.postId,
      action: "OPEN_ITEM",
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
      title: { vi: "Bạn đang rất gần nhau", en: "You are nearby" },
      content: {
        vi: `Khoảng cách hiện tại chỉ còn ${distance}`,
        en: "You are close to the recovery location.",
      },
      entityType: input.postId ? "ITEM" : undefined,
      entityId: input.postId,
      action: input.postId ? "OPEN_ITEM" : undefined,
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
      title: { vi: "Tin nhắn mới", en: "New message" },
      content: {
        vi: "Bạn có tin nhắn mới về quá trình tìm và trả đồ.",
        en: "You have a new message about an item recovery.",
      },
      entityType: "CHAT",
      entityId: input.roomId,
      action: "OPEN_CHAT",
      metadata: {
        sender_avatar: input.senderAvatar || "",
        room_id: input.roomId,
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
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
    });
  }

  async notifyReturnEvent(input: {
    receiverId: string;
    type: string;
    title: string;
    content: string;
    sessionId: string;
    itemId?: string;
    dedupeKey?: string;
  }) {
    const type =
      input.type === "PARTNER_ARRIVED" ? "PARTICIPANT_ARRIVED" : input.type;
    const localized = this.getReturnEventContent(
      type,
      input.title,
      input.content
    );
    return this.createNotification({
      receiverId: input.receiverId,
      category: "IMPORTANT",
      type,
      title: localized.title,
      content: localized.content,
      entityType: "RETURN_SESSION",
      entityId: input.sessionId,
      action: "OPEN_RETURN_SESSION",
      dedupeKey: input.dedupeKey,
      pushPriority: "high",
    });
  }

  private getReturnEventContent(
    type: string,
    fallbackTitle: string,
    fallbackContent: string
  ) {
    const copies: Record<
      string,
      { title: { vi: string; en: string }; content: { vi: string; en: string } }
    > = {
      RETURN_SESSION_CREATED: {
        title: { vi: "Đã tạo phiên trao trả", en: "Return session created" },
        content: {
          vi: "Một phiên trao trả đồ đã được tạo.",
          en: "A return session has been created.",
        },
      },
      MEETUP_PROPOSED: {
        title: { vi: "Đề xuất điểm hẹn mới", en: "New meetup proposal" },
        content: {
          vi: "Bạn nhận được đề xuất địa điểm gặp mặt.",
          en: "You received a meetup location proposal.",
        },
      },
      MEETUP_ACCEPTED: {
        title: {
          vi: "Địa điểm gặp mặt đã được chấp nhận",
          en: "Meetup location accepted",
        },
        content: {
          vi: "Đối phương đã chấp nhận địa điểm gặp mặt.",
          en: "The other participant accepted the meetup location.",
        },
      },
      MEETUP_CANCELLED: {
        title: { vi: "Phiên gặp mặt đã bị hủy", en: "Meetup cancelled" },
        content: {
          vi: "Đối phương đã hủy phiên gặp mặt.",
          en: "The other participant cancelled the meetup.",
        },
      },
      PARTICIPANT_ARRIVED: {
        title: { vi: "Đối phương đã đến", en: "Participant arrived" },
        content: {
          vi: "Đối phương đã có mặt tại điểm hẹn.",
          en: "The other participant has arrived at the meetup.",
        },
      },
      HANDOVER_READY: {
        title: { vi: "Sẵn sàng bàn giao", en: "Ready for handover" },
        content: {
          vi: "Phiên trao trả đã sẵn sàng để xác nhận bàn giao.",
          en: "The return is ready for handover confirmation.",
        },
      },
      HANDOVER_CONFIRMED: {
        title: { vi: "Bàn giao thành công", en: "Handover confirmed" },
        content: {
          vi: "Vật phẩm đã được xác nhận trao trả thành công.",
          en: "The item return has been confirmed successfully.",
        },
      },
      RETURN_COMPLETED: {
        title: { vi: "Trao trả hoàn tất", en: "Return completed" },
        content: {
          vi: "Vật phẩm đã được trao trả thành công.",
          en: "The item has been returned successfully.",
        },
      },
    };

    return (
      copies[type] || {
        title: { vi: fallbackTitle, en: fallbackTitle },
        content: { vi: fallbackContent, en: fallbackContent },
      }
    );
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
