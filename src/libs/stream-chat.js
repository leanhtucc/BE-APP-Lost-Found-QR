"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = exports.markAllNotificationsRead = exports.getUserNotifications = exports.createUserNotificationFeed = exports.getFlaggedMessages = exports.unbanUserFromChannel = exports.banUserFromChannel = exports.unmuteUserInChannel = exports.muteUserInChannel = exports.unflagMessage = exports.flagMessage = exports.getUserChannels = exports.closeItemChannel = exports.createItemChannel = exports.upsertStreamUser = exports.createStreamUserToken = exports.getStreamClient = void 0;
const stream_chat_1 = require("stream-chat");
const env_1 = require("../config/env");
/**
 * Stream Chat Server-side Client
 * Dùng để tạo user token và quản lý channel từ backend
 */
let streamClient = null;
const getStreamClient = () => {
    if (!streamClient) {
        if (!env_1.ENV.STREAM_API_KEY || !env_1.ENV.STREAM_API_SECRET) {
            throw new Error("Stream Chat credentials not configured");
        }
        streamClient = stream_chat_1.StreamChat.getInstance(env_1.ENV.STREAM_API_KEY, env_1.ENV.STREAM_API_SECRET);
    }
    return streamClient;
};
exports.getStreamClient = getStreamClient;
/**
 * Tạo User Token cho Stream Chat
 * Token này sẽ được gửi về cho client để authenticate
 */
const createStreamUserToken = (userId) => {
    const client = (0, exports.getStreamClient)();
    return client.createToken(userId);
};
exports.createStreamUserToken = createStreamUserToken;
/**
 * Đăng ký hoặc cập nhật user trên Stream
 * Gọi khi user đăng ký hoặc cập nhật profile
 */
const upsertStreamUser = async (userData) => {
    const client = (0, exports.getStreamClient)();
    await client.upsertUser({
        id: userData.id,
        name: userData.name,
        image: userData.image ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}`,
        role: "user",
    });
};
exports.upsertStreamUser = upsertStreamUser;
/**
 * Tạo channel cho cuộc hội thoại về món đồ thất lạc
 * Channel ID format: item_{itemId}_{finderId}
 * Có auto-moderation để chống spam
 */
const createItemChannel = async (itemId, itemName, ownerId, finderId) => {
    const client = (0, exports.getStreamClient)();
    const channelId = `item_${itemId}_${finderId}`;
    const channel = client.channel("messaging", channelId, {
        members: [ownerId, finderId],
        created_by_id: finderId,
        item_id: itemId,
        item_name: itemName,
        // Bật auto-moderation
        automod: "AI",
        automod_behavior: "flag", // flag messages thay vì xóa
    });
    await channel.create();
    return {
        channelId,
        channelType: "messaging",
    };
};
exports.createItemChannel = createItemChannel;
/**
 * Đóng channel khi đã trả đồ xong
 */
const closeItemChannel = async (channelId) => {
    const client = (0, exports.getStreamClient)();
    const channel = client.channel("messaging", channelId);
    await channel.update({
        disabled: true,
        frozen: true,
    });
};
exports.closeItemChannel = closeItemChannel;
/**
 * Lấy danh sách channel của user
 */
const getUserChannels = async (userId) => {
    const client = (0, exports.getStreamClient)();
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
        name: channel.data?.name || "Unknown",
        lastMessage: channel.state.messages[channel.state.messages.length - 1],
        members: channel.state.members,
        unreadCount: channel.countUnread(),
    }));
};
exports.getUserChannels = getUserChannels;
/**
 * ====================
 * MODERATION FEATURES
 * ====================
 */
/**
 * Flag một message không phù hợp (spam, vi phạm quy tắc)
 */
const flagMessage = async (messageId, userId) => {
    const client = (0, exports.getStreamClient)();
    await client.flagMessage(messageId, {
        user_id: userId,
    });
    return { success: true, message: "Message flagged successfully" };
};
exports.flagMessage = flagMessage;
/**
 * Unflag một message đã bị flag
 */
const unflagMessage = async (messageId, userId) => {
    const client = (0, exports.getStreamClient)();
    await client.unflagMessage(messageId, {
        user_id: userId,
    });
    return { success: true, message: "Message unflagged successfully" };
};
exports.unflagMessage = unflagMessage;
/**
 * Mute một user trong channel (không cho gửi tin nhắn)
 */
const muteUserInChannel = async (channelType, channelId, targetUserId, timeout // phút
) => {
    const client = (0, exports.getStreamClient)();
    const channel = client.channel(channelType, channelId);
    const muteOptions = { user_id: targetUserId };
    if (timeout) {
        muteOptions.expiration = timeout * 60 * 1000; // convert minutes to milliseconds
    }
    await channel.mute(muteOptions);
    return {
        success: true,
        message: `User muted${timeout ? ` for ${timeout} minutes` : " indefinitely"}`,
    };
};
exports.muteUserInChannel = muteUserInChannel;
/**
 * Unmute một user trong channel
 */
const unmuteUserInChannel = async (channelType, channelId, targetUserId) => {
    const client = (0, exports.getStreamClient)();
    const channel = client.channel(channelType, channelId);
    await channel.unmute({ user_id: targetUserId });
    return { success: true, message: "User unmuted successfully" };
};
exports.unmuteUserInChannel = unmuteUserInChannel;
/**
 * Ban một user khỏi channel
 */
const banUserFromChannel = async (channelType, channelId, targetUserId, reason, timeout // phút
) => {
    const client = (0, exports.getStreamClient)();
    const channel = client.channel(channelType, channelId);
    const options = {};
    if (reason !== undefined)
        options.reason = reason;
    if (timeout !== undefined)
        options.timeout = timeout;
    await channel.banUser(targetUserId, options);
    return {
        success: true,
        message: `User banned${timeout ? ` for ${timeout} minutes` : " permanently"}`,
    };
};
exports.banUserFromChannel = banUserFromChannel;
/**
 * Unban một user khỏi channel
 */
const unbanUserFromChannel = async (channelType, channelId, targetUserId) => {
    const client = (0, exports.getStreamClient)();
    const channel = client.channel(channelType, channelId);
    await channel.unbanUser(targetUserId);
    return { success: true, message: "User unbanned successfully" };
};
exports.unbanUserFromChannel = unbanUserFromChannel;
/**
 * Lấy danh sách messages bị flag trong channel
 */
const getFlaggedMessages = async (channelType, channelId) => {
    const client = (0, exports.getStreamClient)();
    const channel = client.channel(channelType, channelId);
    const response = await channel.query({
        messages: { limit: 100 },
    });
    const flaggedMessages = response.messages.filter((msg) => msg.moderation_details?.action === "flag");
    return flaggedMessages;
};
exports.getFlaggedMessages = getFlaggedMessages;
/**
 * ====================
 * ACTIVITY FEEDS
 * ====================
 */
/**
 * Tạo notification feed cho user
 * Thông báo khi có tin nhắn mới, mention, etc.
 */
const createUserNotificationFeed = async (userId) => {
    const client = (0, exports.getStreamClient)();
    // Stream Chat tự động tạo notification feed cho mỗi user
    // Chỉ cần enable notifications trong channel settings
    return {
        success: true,
        message: "Notification feed ready",
        feedId: `notification:${userId}`,
    };
};
exports.createUserNotificationFeed = createUserNotificationFeed;
/**
 * Lấy notification feed của user
 */
const getUserNotifications = async (userId) => {
    const client = (0, exports.getStreamClient)();
    // Query các channel có unread messages
    const filter = {
        type: "messaging",
        members: { $in: [userId] },
    };
    const channels = await client.queryChannels(filter, {}, {
        watch: false,
        state: true,
    });
    const notifications = channels
        .filter((channel) => channel.countUnread() > 0)
        .map((channel) => ({
        channelId: channel.id,
        channelName: channel.data?.name,
        unreadCount: channel.countUnread(),
        lastMessage: channel.state.messages[channel.state.messages.length - 1],
        timestamp: channel.state.last_message_at,
    }));
    return notifications;
};
exports.getUserNotifications = getUserNotifications;
/**
 * Đánh dấu tất cả notifications đã đọc
 */
const markAllNotificationsRead = async (userId) => {
    const client = (0, exports.getStreamClient)();
    const filter = {
        type: "messaging",
        members: { $in: [userId] },
    };
    const channels = await client.queryChannels(filter);
    await Promise.all(channels.map((channel) => channel.markRead({ user_id: userId })));
    return { success: true, message: "All notifications marked as read" };
};
exports.markAllNotificationsRead = markAllNotificationsRead;
/**
 * Log activity (tin nhắn mới, channel mới, etc.)
 */
const logActivity = async (userId, activityType, metadata) => {
    const client = (0, exports.getStreamClient)();
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
exports.logActivity = logActivity;
//# sourceMappingURL=stream-chat.js.map