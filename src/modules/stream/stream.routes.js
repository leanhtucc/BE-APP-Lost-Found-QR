"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const stream_controller_1 = require("./stream.controller");
const stream_schema_1 = require("./stream.schema");
const router = (0, express_1.Router)();
const streamController = new stream_controller_1.StreamChatController();
/**
 * @route   GET /api/stream/token
 * @desc    Lấy Stream Chat token cho user
 * @access  Protected
 */
router.get("/token", auth_middleware_1.authMiddleware, streamController.getToken);
/**
 * @route   POST /api/stream/channels/:itemId/:finderId
 * @desc    Tạo channel mới cho cuộc hội thoại
 * @access  Protected
 * @params  itemId, finderId
 */
router.post("/channels/:itemId/:finderId", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.createChannelSchema), streamController.createChannel);
/**
 * @route   GET /api/stream/channels
 * @desc    Lấy danh sách channel của user (Inbox)
 * @access  Protected
 */
router.get("/channels", auth_middleware_1.authMiddleware, streamController.getChannels);
/**
 * @route   PUT /api/stream/channels/:channelId/close
 * @desc    Đóng channel khi đã trả đồ xong
 * @access  Protected
 */
router.put("/channels/:channelId/close", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.closeChannelSchema), streamController.closeChannel);
/**
 * ====================
 * MODERATION ROUTES
 * ====================
 */
/**
 * @route   POST /api/stream/messages/:messageId/flag
 * @desc    Flag một message không phù hợp
 * @access  Protected
 */
router.post("/messages/:messageId/flag", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.messageIdSchema), streamController.flagMessageEndpoint);
/**
 * @route   DELETE /api/stream/messages/:messageId/flag
 * @desc    Unflag một message
 * @access  Protected
 */
router.delete("/messages/:messageId/flag", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.messageIdSchema), streamController.unflagMessageEndpoint);
/**
 * @route   POST /api/stream/channels/:channelId/mute/:targetUserId
 * @desc    Mute một user trong channel (timeout optional in minutes via query param)
 * @access  Protected
 * @params  channelId, targetUserId
 * @query   timeout (optional, in minutes)
 */
router.post("/channels/:channelId/mute/:targetUserId", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.muteUserSchema), streamController.muteUser);
/**
 * @route   DELETE /api/stream/channels/:channelId/mute/:targetUserId
 * @desc    Unmute một user trong channel
 * @access  Protected
 */
router.delete("/channels/:channelId/mute/:targetUserId", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.channelUserSchema), streamController.unmuteUser);
/**
 * @route   POST /api/stream/channels/:channelId/ban/:targetUserId
 * @desc    Ban một user khỏi channel (timeout & reason optional via body)
 * @access  Protected
 * @params  channelId, targetUserId
 * @body    reason (optional), timeout (optional, in minutes)
 */
router.post("/channels/:channelId/ban/:targetUserId", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.banUserSchema), streamController.banUser);
/**
 * @route   DELETE /api/stream/channels/:channelId/ban/:targetUserId
 * @desc    Unban một user khỏi channel
 * @access  Protected
 */
router.delete("/channels/:channelId/ban/:targetUserId", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.channelUserSchema), streamController.unbanUser);
/**
 * @route   GET /api/stream/channels/:channelId/flagged-messages
 * @desc    Lấy danh sách messages bị flag
 * @access  Protected
 */
router.get("/channels/:channelId/flagged-messages", auth_middleware_1.authMiddleware, streamController.getFlaggedMessages);
/**
 * ====================
 * NOTIFICATION ROUTES
 * ====================
 */
/**
 * @route   GET /api/stream/notifications
 * @desc    Lấy danh sách notifications
 * @access  Protected
 */
router.get("/notifications", auth_middleware_1.authMiddleware, streamController.getNotifications);
/**
 * @route   POST /api/stream/notifications/mark-read
 * @desc    Đánh dấu tất cả notifications đã đọc
 * @access  Protected
 */
router.post("/notifications/mark-read", auth_middleware_1.authMiddleware, streamController.markNotificationsRead);
/**
 * @route   POST /api/stream/activity/:activityType
 * @desc    Log user activity (query params for metadata)
 * @access  Protected
 * @params  activityType (new_message, new_channel, item_found, item_returned)
 * @query   metadata as query params
 */
router.post("/activity/:activityType", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(stream_schema_1.activitySchema), streamController.logActivityEndpoint);
exports.default = router;
//# sourceMappingURL=stream.routes.js.map