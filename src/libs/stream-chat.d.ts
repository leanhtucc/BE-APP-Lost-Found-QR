import { StreamChat } from "stream-chat";
export declare const getStreamClient: () => StreamChat;
/**
 * Tạo User Token cho Stream Chat
 * Token này sẽ được gửi về cho client để authenticate
 */
export declare const createStreamUserToken: (userId: string) => string;
/**
 * Đăng ký hoặc cập nhật user trên Stream
 * Gọi khi user đăng ký hoặc cập nhật profile
 */
export declare const upsertStreamUser: (userData: {
    id: string;
    name: string;
    image?: string;
    email?: string;
}) => Promise<void>;
/**
 * Tạo channel cho cuộc hội thoại về món đồ thất lạc
 * Channel ID format: item_{itemId}_{finderId}
 * Có auto-moderation để chống spam
 */
export declare const createItemChannel: (itemId: string, itemName: string, ownerId: string, finderId: string) => Promise<{
    channelId: string;
    channelType: string;
}>;
/**
 * Đóng channel khi đã trả đồ xong
 */
export declare const closeItemChannel: (channelId: string) => Promise<void>;
/**
 * Lấy danh sách channel của user
 */
export declare const getUserChannels: (userId: string) => Promise<{
    id: string | undefined;
    name: any;
    lastMessage: import("stream-chat").LocalMessage | undefined;
    members: Record<string, import("stream-chat").ChannelMemberResponse>;
    unreadCount: number;
}[]>;
/**
 * ====================
 * MODERATION FEATURES
 * ====================
 */
/**
 * Flag một message không phù hợp (spam, vi phạm quy tắc)
 */
export declare const flagMessage: (messageId: string, userId: string) => Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Unflag một message đã bị flag
 */
export declare const unflagMessage: (messageId: string, userId: string) => Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Mute một user trong channel (không cho gửi tin nhắn)
 */
export declare const muteUserInChannel: (channelType: string, channelId: string, targetUserId: string, timeout?: number) => Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Unmute một user trong channel
 */
export declare const unmuteUserInChannel: (channelType: string, channelId: string, targetUserId: string) => Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Ban một user khỏi channel
 */
export declare const banUserFromChannel: (channelType: string, channelId: string, targetUserId: string, reason?: string, timeout?: number) => Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Unban một user khỏi channel
 */
export declare const unbanUserFromChannel: (channelType: string, channelId: string, targetUserId: string) => Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Lấy danh sách messages bị flag trong channel
 */
export declare const getFlaggedMessages: (channelType: string, channelId: string) => Promise<import("stream-chat").MessageResponse[]>;
/**
 * ====================
 * ACTIVITY FEEDS
 * ====================
 */
/**
 * Tạo notification feed cho user
 * Thông báo khi có tin nhắn mới, mention, etc.
 */
export declare const createUserNotificationFeed: (userId: string) => Promise<{
    success: boolean;
    message: string;
    feedId: string;
}>;
/**
 * Lấy notification feed của user
 */
export declare const getUserNotifications: (userId: string) => Promise<{
    channelId: string | undefined;
    channelName: any;
    unreadCount: number;
    lastMessage: import("stream-chat").LocalMessage | undefined;
    timestamp: Date | null;
}[]>;
/**
 * Đánh dấu tất cả notifications đã đọc
 */
export declare const markAllNotificationsRead: (userId: string) => Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Log activity (tin nhắn mới, channel mới, etc.)
 */
export declare const logActivity: (userId: string, activityType: "new_message" | "new_channel" | "item_found" | "item_returned", metadata: Record<string, any>) => Promise<{
    success: boolean;
    activity: {
        userId: string;
        type: "new_message" | "new_channel" | "item_found" | "item_returned";
        timestamp: string;
        metadata: Record<string, any>;
    };
}>;
//# sourceMappingURL=stream-chat.d.ts.map