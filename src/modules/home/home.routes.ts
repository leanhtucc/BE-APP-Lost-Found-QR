import { Router } from "express";
import { optionalAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { homeController } from "./home.controller";
import { lostFeedSchema } from "./home.schema";

const router = Router();

/**
 * GET /api/home/lost-feed & /v1/home/lost-feed
 * Unified endpoint combining:
 *  - Public lost items from everyone (available to guests and authenticated users)
 *  - User's own lost items marked with isOwn: true (when authenticated)
 *  - Sorted by distance when lat/lng provided
 */
router.get(
  "/lost-feed",
  optionalAuth,
  validate(lostFeedSchema),
  homeController.getLostFeed
);

export default router;
