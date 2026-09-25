import { Router } from "express";
import {
  authMiddleware,
  optionalAuth,
} from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createFoundReportSchema,
  foundReportIdSchema,
} from "./found-report.schema";
import {
  createFoundReport,
  getFoundFeed,
  getFoundReport,
} from "./found-report.service";
import { lostFeedSchema } from "../home/home.schema";
import { LostFeedQuery } from "../home/home.types";

const router = Router();
router.post(
  "/",
  authMiddleware,
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
      const data = await getFoundReport(req.params.id!);
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
