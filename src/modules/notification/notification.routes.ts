import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { notificationController } from "./notification.controller";
import {
  listNotificationsSchema,
  markOpenedSchema,
} from "./notification.schema";

const router = Router();

// ── Notification Management ──
router.get(
  "/",
  authMiddleware,
  validate(listNotificationsSchema),
  notificationController.getNotifications
);

router.post(
  "/:id/view",
  authMiddleware,
  validate(markOpenedSchema),
  notificationController.markAsViewed
);

export default router;
