"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamChatController = void 0;
const prisma_1 = require("../../libs/prisma");
const stream_chat_1 = require("../../libs/stream-chat");
const response_1 = require("../../utils/response");
class StreamChatController {
    /**
     * GET /api/stream/token
     * Lấy Stream Chat token cho user hiện tại
     * Frontend sẽ dùng token này để connect vào Stream Chat
     */
    getToken = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const user = req.user;
            // Đồng bộ user info lên Stream Chat
            await (0, stream_chat_1.upsertStreamUser)({
                id: userId,
                name: user.displayName || "User",
                email: user.email,
            });
            // Tạo token
            const token = (0, stream_chat_1.createStreamUserToken)(userId);
            response_1.ResponseUtil.success(res, {
                token,
                apiKey: process.env.STREAM_API_KEY,
                userId,
            }, "Stream token generated successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /api/stream/channels/:itemId/:finderId
     * Tạo channel mới cho cuộc hội thoại về món đồ
     * Params: itemId, finderId
     */
    createChannel = async (req, res, next) => {
        try {
            const { itemId, finderId } = req.params;
            // Lấy thông tin item và owner bằng itemId (từ QR code)
            const item = await prisma_1.prisma.item.findFirst({
                where: { itemId: itemId || "" },
                select: {
                    id: true,
                    itemId: true,
                    name: true,
                    ownerId: true,
                    owner: {
                        select: {
                            id: true,
                            displayName: true,
                            email: true,
                            photoURL: true,
                        },
                    },
                },
            });
            if (!item) {
                response_1.ResponseUtil.notFound(res, "Item not found");
                return;
            }
            // Lấy thông tin finder
            const finder = await prisma_1.prisma.user.findFirst({
                where: { id: finderId || "" },
                select: {
                    id: true,
                    displayName: true,
                    email: true,
                    photoURL: true,
                },
            });
            if (!finder) {
                response_1.ResponseUtil.notFound(res, "Finder not found");
                return;
            }
            // Upsert owner lên Stream Chat
            await (0, stream_chat_1.upsertStreamUser)({
                id: item.owner.id,
                name: item.owner.displayName,
                email: item.owner.email,
                image: item.owner.photoURL || "",
            });
            // Upsert finder lên Stream Chat
            await (0, stream_chat_1.upsertStreamUser)({
                id: finder.id,
                name: finder.displayName,
                email: finder.email,
                image: finder.photoURL || "",
            });
            // Tạo channel trên Stream (dùng item.id là primary key)
            if (!finderId) {
                response_1.ResponseUtil.badRequest(res, "Finder ID is required");
                return;
            }
            const channel = await (0, stream_chat_1.createItemChannel)(item.id, item.name, item.ownerId, finderId);
            response_1.ResponseUtil.created(res, {
                channel,
                itemName: item.name,
            }, "Channel created successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /api/stream/channels
     * Lấy danh sách channel của user (Inbox)
     */
    getChannels = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const channels = await (0, stream_chat_1.getUserChannels)(userId);
            response_1.ResponseUtil.success(res, {
                channels,
                total: channels.length,
            }, "Channels retrieved successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PUT /api/stream/channels/:channelId/close
     * Đóng channel khi đã trả đồ xong
     */
    closeChannel = async (req, res, next) => {
        try {
            const { channelId } = req.params;
            if (!channelId) {
                response_1.ResponseUtil.badRequest(res, "Channel ID is required");
                return;
            }
            await (0, stream_chat_1.closeItemChannel)(channelId);
            response_1.ResponseUtil.success(res, {}, "Channel closed successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * ====================
     * MODERATION ENDPOINTS
     * ====================
     */
    /**
     * POST /api/stream/messages/:messageId/flag
     * Flag một message không phù hợp
     */
    flagMessageEndpoint = async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            if (!messageId) {
                response_1.ResponseUtil.badRequest(res, "Message ID is required");
                return;
            }
            const result = await (0, stream_chat_1.flagMessage)(messageId, userId);
            response_1.ResponseUtil.success(res, result, "Message flagged successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * DELETE /api/stream/messages/:messageId/flag
     * Unflag một message
     */
    unflagMessageEndpoint = async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            if (!messageId) {
                response_1.ResponseUtil.badRequest(res, "Message ID is required");
                return;
            }
            const result = await (0, stream_chat_1.unflagMessage)(messageId, userId);
            response_1.ResponseUtil.success(res, result, "Message unflagged successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /api/stream/channels/:channelId/mute/:targetUserId
     * Mute một user trong channel
     */
    muteUser = async (req, res, next) => {
        try {
            const { channelId, targetUserId } = req.params;
            const timeout = req.query.timeout;
            const timeoutNum = timeout ? parseInt(timeout) : undefined;
            if (!channelId || !targetUserId) {
                response_1.ResponseUtil.badRequest(res, "Channel ID and Target User ID are required");
                return;
            }
            const result = await (0, stream_chat_1.muteUserInChannel)("messaging", channelId, targetUserId, timeoutNum);
            response_1.ResponseUtil.success(res, result, "User muted successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * DELETE /api/stream/channels/:channelId/mute/:targetUserId
     * Unmute một user trong channel
     */
    unmuteUser = async (req, res, next) => {
        try {
            const { channelId, targetUserId } = req.params;
            if (!channelId || !targetUserId) {
                response_1.ResponseUtil.badRequest(res, "Channel ID and Target User ID are required");
                return;
            }
            const result = await (0, stream_chat_1.unmuteUserInChannel)("messaging", channelId, targetUserId);
            response_1.ResponseUtil.success(res, result, "User unmuted successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /api/stream/channels/:channelId/ban/:targetUserId
     * Ban một user khỏi channel
     */
    banUser = async (req, res, next) => {
        try {
            const { channelId, targetUserId } = req.params;
            const { reason, timeout } = req.body;
            const timeoutNum = timeout ? parseInt(timeout) : undefined;
            if (!channelId || !targetUserId) {
                response_1.ResponseUtil.badRequest(res, "Channel ID and Target User ID are required");
                return;
            }
            const result = await (0, stream_chat_1.banUserFromChannel)("messaging", channelId, targetUserId, reason, timeoutNum);
            response_1.ResponseUtil.success(res, result, "User banned successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * DELETE /api/stream/channels/:channelId/ban/:targetUserId
     * Unban một user khỏi channel
     */
    unbanUser = async (req, res, next) => {
        try {
            const { channelId, targetUserId } = req.params;
            if (!channelId || !targetUserId) {
                response_1.ResponseUtil.badRequest(res, "Channel ID and Target User ID are required");
                return;
            }
            const result = await (0, stream_chat_1.unbanUserFromChannel)("messaging", channelId, targetUserId);
            response_1.ResponseUtil.success(res, result, "User unbanned successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /api/stream/channels/:channelId/flagged-messages
     * Lấy danh sách messages bị flag trong channel
     */
    getFlaggedMessages = async (req, res, next) => {
        try {
            const { channelId } = req.params;
            if (!channelId) {
                response_1.ResponseUtil.badRequest(res, "Channel ID is required");
                return;
            }
            const messages = await (0, stream_chat_1.getFlaggedMessages)("messaging", channelId);
            response_1.ResponseUtil.success(res, {
                messages,
                total: messages.length,
            }, "Flagged messages retrieved successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * ====================
     * NOTIFICATION ENDPOINTS
     * ====================
     */
    /**
     * GET /api/stream/notifications
     * Lấy danh sách notifications của user
     */
    getNotifications = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const notifications = await (0, stream_chat_1.getUserNotifications)(userId);
            response_1.ResponseUtil.success(res, {
                notifications,
                total: notifications.length,
                unreadTotal: notifications.reduce((sum, n) => sum + n.unreadCount, 0),
            }, "Notifications retrieved successfully");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /api/stream/notifications/mark-read
     * Đánh dấu tất cả notifications đã đọc
     */
    markNotificationsRead = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const result = await (0, stream_chat_1.markAllNotificationsRead)(userId);
            response_1.ResponseUtil.success(res, result, "All notifications marked as read");
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /api/stream/activity
     * Log user activity
     */
    logActivityEndpoint = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { activityType } = req.params;
            const metadata = req.query; // metadata từ query params
            const result = await (0, stream_chat_1.logActivity)(userId, activityType, metadata);
            response_1.ResponseUtil.success(res, result, "Activity logged successfully");
        }
        catch (error) {
            next(error);
        }
    };
}
exports.StreamChatController = StreamChatController;
//# sourceMappingURL=stream.controller.js.map