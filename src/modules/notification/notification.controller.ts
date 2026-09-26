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
      const validatedQuery = res.locals.validatedRequest?.query ?? req.query;
      const { page, per_page, status } = validatedQuery as {
        page: number;
        per_page: number;
        status?: "VIEW" | "UN_VIEW";
      };

      const result = await notificationService.getNotifications(userId, {
        page,
        perPage: per_page,
        status,
      });

      ResponseUtil.success(res, result, "Get notifications successfully.");
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

  markAsViewed = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const result = await notificationService.markNotificationAsViewed(
        userId,
        id || ""
      );
      ResponseUtil.success(
        res,
        result,
        "Notification marked as viewed successfully."
      );
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

  markAllAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await notificationService.markAllAsRead(userId);

      ResponseUtil.success(res, result, "All notifications marked as read");
    } catch (error) {
      next(error);
    }
  };

  getPreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await notificationService.getPreferences(userId);

      ResponseUtil.success(res, result, "Notification preferences retrieved");
    } catch (error) {
      next(error);
    }
  };

  getProfilePreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await notificationService.getProfilePreferences(
        req.user!.id
      );
      ResponseUtil.success(res, result, "Preferences loaded successfully");
    } catch (error) {
      next(error);
    }
  };

  updatePreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await notificationService.updatePreferences(
        userId,
        req.body
      );

      ResponseUtil.success(res, result, "Notification preferences updated");
    } catch (error) {
      next(error);
    }
  };

  updateProfilePreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await notificationService.updateProfilePreferences(
        req.user!.id,
        req.body
      );
      ResponseUtil.success(res, result, "Preferences updated successfully");
    } catch (error) {
      next(error);
    }
  };
}

export const notificationController = new NotificationController();
