import { NextFunction, Request, Response } from "express";
import { ENV } from "../../config/env";
import { AppError } from "../../middlewares/error.middleware";
import {
  banUserFromChannel,
  closeItemChannel,
  createStreamUserToken,
  flagMessage,
  getFlaggedMessages,
  getMessageChannelId,
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
import { ResponseUtil } from "../../utils/response";
import { reportService } from "../report/report.service";
import { prisma } from "../../libs/prisma";
import { createLostItemReturnChannel } from "./stream.service";

const MODERATOR_ROLES = ["admin", "moderator"];

async function isModerator(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return !!row && MODERATOR_ROLES.includes(row.role);
}

/**
 * The caller must belong to the return session that owns this channel.
 * Moderators may bypass this only where `allowModerator` is set.
 * Returns the participants, or null when a moderator bypassed the check.
 */
async function requireChannelParticipant(
  userId: string,
  channelId: string,
  options: { allowModerator?: boolean } = {}
): Promise<{ ownerId: string; finderId: string } | null> {
  if (options.allowModerator && (await isModerator(userId))) return null;
  const session = await prisma.returnSession.findUnique({
    where: { channelId },
    select: { ownerId: true, finderId: true },
  });
  if (!session) {
    throw new AppError("Channel not found", 404, true, "CHANNEL_NOT_FOUND");
  }
  if (userId !== session.ownerId && userId !== session.finderId) {
    throw new AppError(
      "You are not a participant in this return",
      403,
      true,
      "RETURN_FORBIDDEN"
    );
  }
  return session;
}

async function requireModerator(userId: string): Promise<void> {
  if (!(await isModerator(userId))) {
    throw new AppError(
      "Only moderators can perform this action",
      403,
      true,
      "MODERATION_FORBIDDEN"
    );
  }
}

async function requireMessageParticipant(
  userId: string,
  messageId: string
): Promise<void> {
  const channelId = await getMessageChannelId(messageId);
  if (!channelId) {
    throw new AppError("Message not found", 404, true, "MESSAGE_NOT_FOUND");
  }
  await requireChannelParticipant(userId, channelId);
}

function assertValidMuteTarget(
  callerId: string,
  targetUserId: string,
  session: { ownerId: string; finderId: string } | null
): void {
  const valid =
    !!session &&
    targetUserId !== callerId &&
    (targetUserId === session.ownerId || targetUserId === session.finderId);
  if (!valid) {
    throw new AppError(
      "You can only moderate the other participant of this return",
      403,
      true,
      "MODERATION_TARGET_INVALID"
    );
  }
}

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
      // Short-lived token; the client re-requests it (Stream tokenProvider)
      const expiresAt =
        Math.floor(Date.now() / 1000) + ENV.STREAM_TOKEN_TTL_SECONDS;
      const token = createStreamUserToken(userId, expiresAt);

      ResponseUtil.success(
        res,
        {
          token,
          apiKey: ENV.STREAM_API_KEY,
          userId,
          expiresAt,
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
      if (finderId !== req.user!.id) {
        throw new AppError(
          "finderId must match the authenticated user",
          403,
          true,
          "FINDER_ID_MISMATCH"
        );
      }
      const result = await createLostItemReturnChannel(req.user!.id, itemId!);

      ResponseUtil.created(
        res,
        {
          ...result,
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
      const userId = req.guest?.id ?? req.user!.id;
      const { channelId } = req.params;

      const session = await prisma.returnSession.findUnique({
        where: { channelId },
        select: { ownerId: true, finderId: true },
      });
      if (!session)
        throw new AppError("Channel not found", 404, true, "CHANNEL_NOT_FOUND");
      if (userId !== session.ownerId && userId !== session.finderId) {
        throw new AppError(
          "You are not a participant in this return",
          403,
          true,
          "RETURN_FORBIDDEN"
        );
      }

      if (!channelId) {
        ResponseUtil.badRequest(res, "Channel ID is required");
        return;
      }

      const settlement = await reportService.completeEscrowFromChannel(
        userId,
        channelId
      );

      await closeItemChannel(channelId);

      ResponseUtil.success(
        res,
        {
          settlement,
        },
        settlement
          ? "Channel closed and settlement completed successfully"
          : "Channel closed successfully"
      );
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

      await requireMessageParticipant(userId, messageId);
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

      await requireMessageParticipant(userId, messageId);
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

      const muteCallerId = req.user!.id;
      assertValidMuteTarget(
        muteCallerId,
        targetUserId,
        await requireChannelParticipant(muteCallerId, channelId)
      );
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

      const unmuteCallerId = req.user!.id;
      assertValidMuteTarget(
        unmuteCallerId,
        targetUserId,
        await requireChannelParticipant(unmuteCallerId, channelId)
      );
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

      await requireModerator(req.user!.id);
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

      await requireModerator(req.user!.id);
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

      await requireChannelParticipant(req.user!.id, channelId, {
        allowModerator: true,
      });
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

      const result = await logActivity(
        userId,
        activityType as any,
        metadata as any
      );

      ResponseUtil.success(res, result, "Activity logged successfully");
    } catch (error) {
      next(error);
    }
  };
}
