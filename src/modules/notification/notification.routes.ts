import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { notificationController } from "./notification.controller";
import {
  listNotificationsSchema,
  markNotificationReadSchema,
  markOpenedSchema,
  registerDeviceSchema,
  unregisterDeviceSchema,
  updatePreferenceSchema,
} from "./notification.schema";

const router = Router();

// ── Notification Management ──
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

router.post("/read-all", authMiddleware, notificationController.markAllAsRead);

router.patch(
  "/:id/read",
  authMiddleware,
  validate(markNotificationReadSchema),
  notificationController.markAsRead
);

router.post(
  "/:id/opened",
  authMiddleware,
  validate(markOpenedSchema),
  notificationController.markAsOpened
);

// ── Preferences ──
router.get(
  "/preferences",
  authMiddleware,
  notificationController.getPreferences
);

router.patch(
  "/preferences",
  authMiddleware,
  validate(updatePreferenceSchema),
  notificationController.updatePreferences
);

// ── Devices ──
router.post(
  "/devices",
  authMiddleware,
  validate(registerDeviceSchema),
  notificationController.registerDevice
);

router.delete(
  "/devices/:deviceId",
  authMiddleware,
  validate(unregisterDeviceSchema),
  notificationController.unregisterDevice
);

// ── Internal / Cron Job ──
router.post(
  "/internal/digest",
  notificationController.triggerDailyDigest
);

export default router;
