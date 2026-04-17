import { NextFunction, Request, Response } from "express";
import { ResponseUtil } from "../../utils/response";
import { notificationService } from "./notification.service";

export class NotificationController {
  getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { category, page, limit } = req.query as unknown as {
        category?: "IMPORTANT" | "TRANSACTION" | "ITEM" | "SOCIAL";
        page: number;
        limit: number;
      };

      const result = await notificationService.getNotifications(userId, {
        category,
        page,
        limit,
      });

      ResponseUtil.success(res, result, "Notifications retrieved successfully");
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const result = await notificationService.markNotificationAsRead(
        userId,
        id || ""
      );
      ResponseUtil.success(res, result, "Notification marked as read");
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const unreadCount = await notificationService.getUnreadCount(userId);

      ResponseUtil.success(
        res,
        {
          unread_count: unreadCount,
        },
        "Unread notification count retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}

export const notificationController = new NotificationController();
