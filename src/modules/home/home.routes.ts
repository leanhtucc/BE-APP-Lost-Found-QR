import { Router } from "express";
import { optionalAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { homeController } from "./home.controller";
import { lostFeedSchema } from "./home.schema";

const router = Router();

/**
 * GET /api/home/lost-feed & /v1/home/lost-feed
 * Unified endpoint combining:
 *  - LOST items from everyone within the server-capped 10 km radar
 *  - User's own nearby LOST items marked with isOwn: true (when authenticated)
 *  - Required current coordinates and nearest-first sorting
 */
router.get(
  "/lost-feed",
  optionalAuth,
  validate(lostFeedSchema),
  homeController.getLostFeed
);

export default router;
