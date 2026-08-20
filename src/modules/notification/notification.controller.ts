import { NextFunction, Request, Response } from "express";
import { ResponseUtil } from "../../utils/response";
import { notificationService } from "./notification.service";
import { notificationScheduler } from "./notification.scheduler";
import { AppError } from "../../middlewares/error.middleware";

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

  markAsOpened = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const result = await notificationService.markNotificationAsOpened(
        userId,
        id || ""
      );
      ResponseUtil.success(res, result, "Notification marked as opened");
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

  updatePreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await notificationService.updatePreferences(userId, req.body);

      ResponseUtil.success(res, result, "Notification preferences updated");
    } catch (error) {
      next(error);
    }
  };

  registerDevice = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await notificationService.registerDevice(userId, req.body);

      ResponseUtil.success(res, result, "Device push token registered successfully");
    } catch (error) {
      next(error);
    }
  };

  unregisterDevice = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { deviceId } = req.params;

      const result = await notificationService.unregisterDevice(userId, deviceId || "");
      ResponseUtil.success(res, result, "Device unregistered");
    } catch (error) {
      next(error);
    }
  };

  triggerDailyDigest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const secretHeader = req.headers["x-internal-secret"];
      const expectedSecret = process.env.INTERNAL_JOB_SECRET || "internal_secret_key_change_me";

      if (secretHeader !== expectedSecret) {
        throw new AppError("Forbidden: Invalid internal job secret", 403);
      }

      const dryRun = req.query.dryRun === "true";
      const targetTimeBucket = req.query.timeBucket ? String(req.query.timeBucket) : undefined;

      const digestResult = await notificationScheduler.runDailyDigestJob({
        dryRun,
        targetTimeBucket,
      });

      ResponseUtil.success(res, digestResult, "Daily digest job executed");
    } catch (error) {
      next(error);
    }
  };
}

export const notificationController = new NotificationController();
