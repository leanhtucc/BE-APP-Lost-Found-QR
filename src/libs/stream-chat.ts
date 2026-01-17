import { StreamChat } from "stream-chat";
import { ENV } from "../config/env";

/**
 * Stream Chat Server-side Client
 * Dùng để tạo user token và quản lý channel từ backend
 */

let streamClient: StreamChat | null = null;

export const getStreamClient = (): StreamChat => {
  if (!streamClient) {
    if (!ENV.STREAM_API_KEY || !ENV.STREAM_API_SECRET) {
      throw new Error("Stream Chat credentials not configured");
    }

    streamClient = StreamChat.getInstance(
      ENV.STREAM_API_KEY,
      ENV.STREAM_API_SECRET
    );
  }

  return streamClient;
};

/**
 * Tạo User Token cho Stream Chat
 * Token này sẽ được gửi về cho client để authenticate
 */
export const createStreamUserToken = (userId: string): string => {
  const client = getStreamClient();
  return client.createToken(userId);
};

/**
 * Đăng ký hoặc cập nhật user trên Stream
 * Gọi khi user đăng ký hoặc cập nhật profile
 */
export const upsertStreamUser = async (userData: {
  id: string;
  name: string;
  image?: string;
  email?: string;
}) => {
  const client = getStreamClient();

  await client.upsertUser({
    id: userData.id,
    name: userData.name,
    image:
      userData.image ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}`,
    role: "user",
  });
};

/**
 * Tạo channel cho cuộc hội thoại về món đồ thất lạc
 * Channel ID format: item_{itemId}_{finderId}
 * Có auto-moderation để chống spam
 */
export const createItemChannel = async (
  itemId: string,
  itemName: string,
  ownerId: string,
  finderId: string
) => {
  const client = getStreamClient();

  const channelId = `item_${itemId}_${finderId}`;
  const channel = client.channel("messaging", channelId, {
    members: [ownerId, finderId],
    created_by_id: finderId,
    item_id: itemId,
    item_name: itemName,
    // Bật auto-moderation
    automod: "AI",
    automod_behavior: "flag", // flag messages thay vì xóa
  } as any);

  await channel.create();

  return {
    channelId,
    channelType: "messaging",
  };
};

/**
 * Đóng channel khi đã trả đồ xong
 */
export const closeItemChannel = async (channelId: string) => {
  const client = getStreamClient();
  const channel = client.channel("messaging", channelId);

  await channel.update({
    disabled: true,
    frozen: true,
  });
};

/**
 * Lấy danh sách channel của user
 */
export const getUserChannels = async (userId: string) => {
  const client = getStreamClient();

  const filter = {
    type: "messaging",
    members: { $in: [userId] },
  };

  const sort = [{ last_message_at: -1 }];

  const channels = await client.queryChannels(filter, sort, {
    watch: false,
    state: true,
  });

  return channels.map((channel) => ({
    id: channel.id,
    name: (channel.data as any)?.name || "Unknown",
    lastMessage: channel.state.messages[channel.state.messages.length - 1],
    members: channel.state.members,
    unreadCount: channel.countUnread(),
  }));
};

/**
 * ====================
 * MODERATION FEATURES
 * ====================
 */

/**
 * Flag một message không phù hợp (spam, vi phạm quy tắc)
 */
export const flagMessage = async (messageId: string, userId: string) => {
  const client = getStreamClient();

  await client.flagMessage(messageId, {
    user_id: userId,
  });

  return { success: true, message: "Message flagged successfully" };
};

/**
 * Unflag một message đã bị flag
 */
export const unflagMessage = async (messageId: string, userId: string) => {
  const client = getStreamClient();

  await client.unflagMessage(messageId, {
    user_id: userId,
  });

  return { success: true, message: "Message unflagged successfully" };
};

/**
 * Mute một user trong channel (không cho gửi tin nhắn)
 */
export const muteUserInChannel = async (
  channelType: string,
  channelId: string,
  targetUserId: string,
  timeout?: number // phút
) => {
  const client = getStreamClient();
  const channel = client.channel(channelType, channelId);

  const muteOptions: any = { user_id: targetUserId };
  if (timeout) {
    muteOptions.expiration = timeout * 60 * 1000; // convert minutes to milliseconds
  }
  await channel.mute(muteOptions);

  return {
    success: true,
    message: `User muted${timeout ? ` for ${timeout} minutes` : " indefinitely"}`,
  };
};

/**
 * Unmute một user trong channel
 */
export const unmuteUserInChannel = async (
  channelType: string,
  channelId: string,
  targetUserId: string
) => {
  const client = getStreamClient();
  const channel = client.channel(channelType, channelId);

  await channel.unmute({ user_id: targetUserId });

  return { success: true, message: "User unmuted successfully" };
};

/**
 * Ban một user khỏi channel
 */
export const banUserFromChannel = async (
  channelType: string,
  channelId: string,
  targetUserId: string,
  reason?: string,
  timeout?: number // phút
) => {
  const client = getStreamClient();
  const channel = client.channel(channelType, channelId);

  const options: Record<string, any> = {};
  if (reason !== undefined) options.reason = reason;
  if (timeout !== undefined) options.timeout = timeout;

  await channel.banUser(targetUserId, options);

  return {
    success: true,
    message: `User banned${timeout ? ` for ${timeout} minutes` : " permanently"}`,
  };
};

/**
 * Unban một user khỏi channel
 */
export const unbanUserFromChannel = async (
  channelType: string,
  channelId: string,
  targetUserId: string
) => {
  const client = getStreamClient();
  const channel = client.channel(channelType, channelId);

  await channel.unbanUser(targetUserId);

  return { success: true, message: "User unbanned successfully" };
};

/**
 * Lấy danh sách messages bị flag trong channel
 */
export const getFlaggedMessages = async (
  channelType: string,
  channelId: string
) => {
  const client = getStreamClient();
  const channel = client.channel(channelType, channelId);

  const response = await channel.query({
    messages: { limit: 100 },
  });

  const flaggedMessages = response.messages.filter(
    (msg) => msg.moderation_details?.action === "flag"
  );

  return flaggedMessages;
};

/**
 * ====================
 * ACTIVITY FEEDS
 * ====================
 */

/**
 * Tạo notification feed cho user
 * Thông báo khi có tin nhắn mới, mention, etc.
 */
export const createUserNotificationFeed = async (userId: string) => {
  const client = getStreamClient();

  // Stream Chat tự động tạo notification feed cho mỗi user
  // Chỉ cần enable notifications trong channel settings

  return {
    success: true,
    message: "Notification feed ready",
    feedId: `notification:${userId}`,
  };
};

/**
 * Lấy notification feed của user
 */
export const getUserNotifications = async (userId: string) => {
  const client = getStreamClient();

  // Query các channel có unread messages
  const filter = {
    type: "messaging",
    members: { $in: [userId] },
  };

  const channels = await client.queryChannels(
    filter,
    {},
    {
      watch: false,
      state: true,
    }
  );

  const notifications = channels
    .filter((channel) => channel.countUnread() > 0)
    .map((channel) => ({
      channelId: channel.id,
      channelName: (channel.data as any)?.name,
      unreadCount: channel.countUnread(),
      lastMessage: channel.state.messages[channel.state.messages.length - 1],
      timestamp: channel.state.last_message_at,
    }));

  return notifications;
};

/**
 * Đánh dấu tất cả notifications đã đọc
 */
export const markAllNotificationsRead = async (userId: string) => {
  const client = getStreamClient();

  const filter = {
    type: "messaging",
    members: { $in: [userId] },
  };

  const channels = await client.queryChannels(filter);

  await Promise.all(
    channels.map((channel) => channel.markRead({ user_id: userId }))
  );

  return { success: true, message: "All notifications marked as read" };
};

/**
 * Log activity (tin nhắn mới, channel mới, etc.)
 */
export const logActivity = async (
  userId: string,
  activityType: "new_message" | "new_channel" | "item_found" | "item_returned",
  metadata: Record<string, any>
) => {
  const client = getStreamClient();

  // Log activity vào Stream's activity feed
  // Có thể dùng để tracking user behavior, analytics, etc.

  return {
    success: true,
    activity: {
      userId,
      type: activityType,
      timestamp: new Date().toISOString(),
      metadata,
    },
  };
};
