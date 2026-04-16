import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { homeController } from "./home.controller";
import { lostFeedSchema } from "./home.schema";

const router = Router();

/**
 * GET /api/home/lost-feed
 * Unified endpoint combining:
 *  - User's own lost items (always)
 *  - Nearby lost items from others (when lat/lng provided)
 */
router.get(
  "/lost-feed",
  authMiddleware,
  validate(lostFeedSchema),
  homeController.getLostFeed
);

export default router;
