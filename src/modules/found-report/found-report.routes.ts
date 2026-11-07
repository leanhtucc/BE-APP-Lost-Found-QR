import { Router } from "express";
import {
  authMiddleware,
  optionalAuth,
} from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { rateLimit } from "../../middlewares/rate-limit.middleware";
import {
  createFoundReportSchema,
  createFoundReportClaimSchema,
  foundReportIdSchema,
  reviewFoundReportClaimSchema,
} from "./found-report.schema";
import {
  createFoundReport,
  getFoundFeed,
  getFoundReport,
  createFoundReportClaim,
  getMyFoundReportClaim,
  listFoundReportClaims,
  acceptFoundReportClaim,
  rejectFoundReportClaim,
} from "./found-report.service";
import { lostFeedSchema } from "../home/home.schema";
import { LostFeedQuery } from "../home/home.types";

const router = Router();

const HOUR_MS = 60 * 60 * 1000;
// Authenticated limiters key on the user id (set by authMiddleware), falling back to IP.
const createReportLimiter = rateLimit({ windowMs: HOUR_MS, max: 10 });
const createClaimLimiter = rateLimit({ windowMs: HOUR_MS, max: 10 });
// Public feed: per IP, to make bulk scraping harder.
const feedLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
});

router.post(
  "/:id/claims",
  authMiddleware,
  createClaimLimiter,
  validate(createFoundReportClaimSchema),
  async (req, res, next) => {
    try {
      const data = await createFoundReportClaim(
        req.user!.id,
        req.params.id!,
        req.body.ownershipProof
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  "/:id/claims/mine",
  authMiddleware,
  validate(foundReportIdSchema),
  async (req, res, next) => {
    try {
      const data = await getMyFoundReportClaim(req.user!.id, req.params.id!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  "/:id/claims",
  authMiddleware,
  validate(foundReportIdSchema),
  async (req, res, next) => {
    try {
      const data = await listFoundReportClaims(req.user!.id, req.params.id!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);
router.post(
  "/:id/claims/:claimId/accept",
  authMiddleware,
  validate(reviewFoundReportClaimSchema),
  async (req, res, next) => {
    try {
      const data = await acceptFoundReportClaim(
        req.user!.id,
        req.params.id!,
        req.params.claimId!
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);
router.post(
  "/:id/claims/:claimId/reject",
  authMiddleware,
  validate(reviewFoundReportClaimSchema),
  async (req, res, next) => {
    try {
      const data = await rejectFoundReportClaim(
        req.user!.id,
        req.params.id!,
        req.params.claimId!
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);
router.post(
  "/",
  authMiddleware,
  createReportLimiter,
  validate(createFoundReportSchema),
  async (req, res, next) => {
    try {
      const data = await createFoundReport(req.user!.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/feed",
  feedLimiter,
  optionalAuth,
  validate(lostFeedSchema),
  async (req, res, next) => {
    try {
      const validatedRequest = res.locals.validatedRequest as
        { query?: LostFeedQuery } | undefined;
      const query =
        validatedRequest?.query ?? (req.query as unknown as LostFeedQuery);
      const cards = await getFoundFeed(req.user?.id, query);
      const pins = cards.map((c) => ({
        itemId: c.itemId,
        lat: c.lostLat!,
        lng: c.lostLng!,
        isOwn: c.isOwn,
      }));
      res.json({
        success: true,
        data: {
          cards,
          pins,
          totalCount: cards.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id",
  optionalAuth,
  validate(foundReportIdSchema),
  async (req, res, next) => {
    try {
      const data = await getFoundReport(req.params.id!, req.user?.id);
      if (!data) {
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy bài đăng" });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
