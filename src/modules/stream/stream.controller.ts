import { NextFunction, Request, Response } from "express";
import { prisma } from "../../libs/prisma";
import {
  banUserFromChannel,
  closeItemChannel,
  createItemChannel,
  createStreamUserToken,
  flagMessage,
  getFlaggedMessages,
  getUserChannels,
  getUserNotifications,
  logActivity,
  markAllNotificationsRead,
  muteUserInChannel,
  unbanUserFromChannel,
  unflagMessage,
  unmuteUserInChannel,
  upsertStreamUser,
} from "../../libs/stream-chat";
import { notificationService } from "../notification/notification.service";
import { ResponseUtil } from "../../utils/response";

export class StreamChatController {
  /**
   * GET /api/stream/token
   * Lấy Stream Chat token cho user hiện tại
   * Frontend sẽ dùng token này để connect vào Stream Chat
   */
  getToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // Đồng bộ user info lên Stream Chat
      await upsertStreamUser({
        id: userId,
        name: user.email.split("@")[0] || "User",
        email: user.email,
      });

      // Tạo token
      const token = createStreamUserToken(userId);

      ResponseUtil.success(
        res,
        {
          token,
          apiKey: process.env.STREAM_API_KEY,
          userId,
        },
        "Stream token generated successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/stream/channels/:itemId/:finderId
   * Tạo channel mới cho cuộc hội thoại về món đồ
   * Params: itemId, finderId
   */
  createChannel = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { itemId, finderId } = req.params;

      // Lấy thông tin item và owner bằng itemId (từ QR code)
      const item = await prisma.item.findFirst({
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
        ResponseUtil.notFound(res, "Item not found");
        return;
      }

      // Lấy thông tin finder
      const finder = await prisma.user.findFirst({
        where: { id: finderId || "" },
        select: {
          id: true,
          displayName: true,
          email: true,
          photoURL: true,
        },
      });

      if (!finder) {
        ResponseUtil.notFound(res, "Finder not found");
        return;
      }

      // Upsert owner lên Stream Chat
      await upsertStreamUser({
        id: item.owner.id,
        name: item.owner.displayName,
        email: item.owner.email,
        image: item.owner.photoURL || "",
      });

      // Upsert finder lên Stream Chat
      await upsertStreamUser({
        id: finder.id,
        name: finder.displayName,
        email: finder.email,
        image: finder.photoURL || "",
      });

      // Tạo channel trên Stream (dùng item.id là primary key)
      if (!finderId) {
        ResponseUtil.badRequest(res, "Finder ID is required");
        return;
      }

      const channel = await createItemChannel(
        item.id,
        item.name,
        item.ownerId,
        finderId
      );

      ResponseUtil.created(
        res,
        {
          channel,
          itemName: item.name,
        },
        "Channel created successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/stream/channels
   * Lấy danh sách channel của user (Inbox)
   */
  getChannels = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;

      const channels = await getUserChannels(userId);

      ResponseUtil.success(
        res,
        {
          channels,
          total: channels.length,
        },
        "Channels retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/stream/channels/:channelId/close
   * Đóng channel khi đã trả đồ xong
   */
  closeChannel = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { channelId } = req.params;

      if (!channelId) {
        ResponseUtil.badRequest(res, "Channel ID is required");
        return;
      }

      await closeItemChannel(channelId);

      ResponseUtil.success(res, {}, "Channel closed successfully");
    } catch (error) {
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
  flagMessageEndpoint = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { messageId } = req.params;
      const userId = req.user!.id;

      if (!messageId) {
        ResponseUtil.badRequest(res, "Message ID is required");
        return;
      }

      const result = await flagMessage(messageId, userId);

      ResponseUtil.success(res, result, "Message flagged successfully");
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/stream/messages/:messageId/flag
   * Unflag một message
   */
  unflagMessageEndpoint = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { messageId } = req.params;
      const userId = req.user!.id;

      if (!messageId) {
        ResponseUtil.badRequest(res, "Message ID is required");
        return;
      }

      const result = await unflagMessage(messageId, userId);

      ResponseUtil.success(res, result, "Message unflagged successfully");
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/stream/channels/:channelId/mute/:targetUserId
   * Mute một user trong channel
   */
  muteUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { channelId, targetUserId } = req.params;
      const timeout = req.query.timeout as string | undefined;
      const timeoutNum = timeout ? parseInt(timeout) : undefined;

      if (!channelId || !targetUserId) {
        ResponseUtil.badRequest(
          res,
          "Channel ID and Target User ID are required"
        );
        return;
      }

      const result = await muteUserInChannel(
        "messaging",
        channelId,
        targetUserId,
        timeoutNum
      );

      ResponseUtil.success(res, result, "User muted successfully");
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/stream/channels/:channelId/mute/:targetUserId
   * Unmute một user trong channel
   */
  unmuteUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { channelId, targetUserId } = req.params;

      if (!channelId || !targetUserId) {
        ResponseUtil.badRequest(
          res,
          "Channel ID and Target User ID are required"
        );
        return;
      }

      const result = await unmuteUserInChannel(
        "messaging",
        channelId,
        targetUserId
      );

      ResponseUtil.success(res, result, "User unmuted successfully");
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/stream/channels/:channelId/ban/:targetUserId
   * Ban một user khỏi channel
   */
  banUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { channelId, targetUserId } = req.params;
      const { reason, timeout } = req.body;
      const timeoutNum = timeout ? parseInt(timeout) : undefined;

      if (!channelId || !targetUserId) {
        ResponseUtil.badRequest(
          res,
          "Channel ID and Target User ID are required"
        );
        return;
      }

      const result = await banUserFromChannel(
        "messaging",
        channelId,
        targetUserId,
        reason,
        timeoutNum
      );

      ResponseUtil.success(res, result, "User banned successfully");
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/stream/channels/:channelId/ban/:targetUserId
   * Unban một user khỏi channel
   */
  unbanUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { channelId, targetUserId } = req.params;

      if (!channelId || !targetUserId) {
        ResponseUtil.badRequest(
          res,
          "Channel ID and Target User ID are required"
        );
        return;
      }

      const result = await unbanUserFromChannel(
        "messaging",
        channelId,
        targetUserId
      );

      ResponseUtil.success(res, result, "User unbanned successfully");
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/stream/channels/:channelId/flagged-messages
   * Lấy danh sách messages bị flag trong channel
   */
  getFlaggedMessages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { channelId } = req.params;

      if (!channelId) {
        ResponseUtil.badRequest(res, "Channel ID is required");
        return;
      }

      const messages = await getFlaggedMessages("messaging", channelId);

      ResponseUtil.success(
        res,
        {
          messages,
          total: messages.length,
        },
        "Flagged messages retrieved successfully"
      );
    } catch (error) {
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
  getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;

      const notifications = await getUserNotifications(userId);

      ResponseUtil.success(
        res,
        {
          notifications,
          total: notifications.length,
          unreadTotal: notifications.reduce((sum, n) => sum + n.unreadCount, 0),
        },
        "Notifications retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/stream/notifications/mark-read
   * Đánh dấu tất cả notifications đã đọc
   */
  markNotificationsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;

      const result = await markAllNotificationsRead(userId);

      ResponseUtil.success(res, result, "All notifications marked as read");
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/stream/activity
   * Log user activity
   */
  logActivityEndpoint = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { activityType } = req.params;
      const metadata = req.query; // metadata từ query params

      const getStringValue = (value: unknown): string => {
        if (typeof value === "string") return value;
        if (Array.isArray(value) && typeof value[0] === "string") return value[0];
        return "";
      };

      const result = await logActivity(
        userId,
        activityType as any,
        metadata as any
      );

      if (activityType === "new_message") {
        const targetUserId = getStringValue(metadata.target_user_id);

        if (targetUserId && targetUserId !== userId) {
          const messagePreview =
            getStringValue(metadata.message_preview) || "Bạn có một tin nhắn mới";

          await notificationService.notifyNewChat({
            receiverId: targetUserId,
            senderAvatar: getStringValue(metadata.sender_avatar),
            roomId: getStringValue(metadata.room_id),
            messagePreview,
            itemId: getStringValue(metadata.item_id),
          });
        }
      }

      ResponseUtil.success(res, result, "Activity logged successfully");
    } catch (error) {
      next(error);
    }
  };
}
