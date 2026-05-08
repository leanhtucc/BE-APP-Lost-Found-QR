import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { notificationController } from "./notification.controller";
import {
  listNotificationsSchema,
  markNotificationReadSchema,
} from "./notification.schema";

const router = Router();

router.get(
  "/",
  authMiddleware,
  validate(listNotificationsSchema),
  notificationController.getNotifications
);

router.get(
  "/unread-count",
  authMiddleware,
  notificationController.getUnreadCount
);

router.post(
  "/read-all",
  authMiddleware,
  notificationController.markAllAsRead
);

router.patch(
  "/:id/read",
  authMiddleware,
  validate(markNotificationReadSchema),
  notificationController.markAsRead
);

export default router;
