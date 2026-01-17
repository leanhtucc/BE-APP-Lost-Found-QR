import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { StreamChatController } from "./stream.controller";
import { closeChannelSchema, createChannelSchema } from "./stream.schema";

const router = Router();
const streamController = new StreamChatController();

/**
 * @route   GET /api/stream/token
 * @desc    Lấy Stream Chat token cho user
 * @access  Protected
 */
router.get("/token", authMiddleware, streamController.getToken);

/**
 * @route   POST /api/stream/channels/:itemId/:finderId
 * @desc    Tạo channel mới cho cuộc hội thoại
 * @access  Protected
 * @params  itemId, finderId
 */
router.post(
  "/channels/:itemId/:finderId",
  authMiddleware,
  validate(createChannelSchema),
  streamController.createChannel
);

/**
 * @route   GET /api/stream/channels
 * @desc    Lấy danh sách channel của user (Inbox)
 * @access  Protected
 */
router.get("/channels", authMiddleware, streamController.getChannels);

/**
 * @route   PUT /api/stream/channels/:channelId/close
 * @desc    Đóng channel khi đã trả đồ xong
 * @access  Protected
 */
router.put(
  "/channels/:channelId/close",
  authMiddleware,
  validate(closeChannelSchema),
  streamController.closeChannel
);

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
router.post(
  "/messages/:messageId/flag",
  authMiddleware,
  streamController.flagMessageEndpoint
);

/**
 * @route   DELETE /api/stream/messages/:messageId/flag
 * @desc    Unflag một message
 * @access  Protected
 */
router.delete(
  "/messages/:messageId/flag",
  authMiddleware,
  streamController.unflagMessageEndpoint
);

/**
 * @route   POST /api/stream/channels/:channelId/mute/:targetUserId
 * @desc    Mute một user trong channel
 * @access  Protected
 */
router.post(
  "/channels/:channelId/mute/:targetUserId",
  authMiddleware,
  streamController.muteUser
);

/**
 * @route   DELETE /api/stream/channels/:channelId/mute/:targetUserId
 * @desc    Unmute một user trong channel
 * @access  Protected
 */
router.delete(
  "/channels/:channelId/mute/:targetUserId",
  authMiddleware,
  streamController.unmuteUser
);

/**
 * @route   POST /api/stream/channels/:channelId/ban/:targetUserId
 * @desc    Ban một user khỏi channel
 * @access  Protected
 */
router.post(
  "/channels/:channelId/ban/:targetUserId",
  authMiddleware,
  streamController.banUser
);

/**
 * @route   DELETE /api/stream/channels/:channelId/ban/:targetUserId
 * @desc    Unban một user khỏi channel
 * @access  Protected
 */
router.delete(
  "/channels/:channelId/ban/:targetUserId",
  authMiddleware,
  streamController.unbanUser
);

/**
 * @route   GET /api/stream/channels/:channelId/flagged-messages
 * @desc    Lấy danh sách messages bị flag
 * @access  Protected
 */
router.get(
  "/channels/:channelId/flagged-messages",
  authMiddleware,
  streamController.getFlaggedMessages
);

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
router.get("/notifications", authMiddleware, streamController.getNotifications);

/**
 * @route   POST /api/stream/notifications/mark-read
 * @desc    Đánh dấu tất cả notifications đã đọc
 * @access  Protected
 */
router.post(
  "/notifications/mark-read",
  authMiddleware,
  streamController.markNotificationsRead
);

/**
 * @route   POST /api/stream/activity
 * @desc    Log user activity
 * @access  Protected
 */
router.post("/activity", authMiddleware, streamController.logActivityEndpoint);

export default router;
