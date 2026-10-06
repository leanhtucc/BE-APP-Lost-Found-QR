/**
 * Standardized notification templates for daily digest and automated reminders.
 */

export interface NotificationTemplateContent {
  title: string;
  content: string;
  type: string;
  category: "IMPORTANT" | "TRANSACTION" | "ITEM" | "SOCIAL";
  deeplink: string;
}

export class NotificationTemplates {
  static dailyNearbyDigest(
    count: number,
    nearestKm: string
  ): NotificationTemplateContent {
    return {
      title: "Cảnh báo vật phẩm thất lạc gần bạn 📍",
      content: `Có ${count} đồ vật được báo thất lạc quanh khu vực của bạn. Vật gần nhất cách bạn ${nearestKm}. Mở bản đồ để giúp đỡ!`,
      type: "DAILY_NEARBY_DIGEST",
      category: "IMPORTANT",
      deeplink: "HomeMap",
    };
  }

  static itemProgressDigest(
    itemName: string,
    countNearby: number
  ): NotificationTemplateContent {
    return {
      title: "Cập nhật tiến độ tìm kiếm 🔍",
      content: `Hôm nay có ${countNearby} lượt hoạt động ở gần khu vực bạn làm mất ${itemName}. Mở kiểm tra ngay!`,
      type: "ITEM_PROGRESS_DIGEST",
      category: "ITEM",
      deeplink: "LostItemDetail",
    };
  }

  static unreadChatReminder(
    senderName: string,
    itemName: string
  ): NotificationTemplateContent {
    return {
      title: "Bạn có tin nhắn chưa đọc 💬",
      content: `${senderName} đang chờ phản hồi của bạn về món đồ ${itemName}.`,
      type: "UNREAD_CHAT_REMINDER",
      category: "SOCIAL",
      deeplink: "ChatRoom",
    };
  }

  static completeProfileReminder(
    itemName: string
  ): NotificationTemplateContent {
    return {
      title: "Tăng khả năng tìm lại đồ vật 📸",
      content: `Bổ sung thêm ảnh và thông tin chi tiết cho ${itemName} để người nhặt dễ nhận dạng hơn.`,
      type: "COMPLETE_PROFILE_REMINDER",
      category: "ITEM",
      deeplink: "LostItemDetail",
    };
  }

  static weeklyActivityReport(
    lostCount: number,
    foundCount: number
  ): NotificationTemplateContent {
    return {
      title: "Báo cáo hoạt động tuần 📊",
      content: `Tuần qua có ${lostCount} vật bị mất trong khu vực của bạn và ${foundCount} vật đã tìm lại thành công!`,
      type: "WEEKLY_REPORT",
      category: "SOCIAL",
      deeplink: "HomeMap",
    };
  }
}
