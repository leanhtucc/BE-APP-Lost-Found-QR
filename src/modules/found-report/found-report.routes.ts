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
import { createFoundReport, getFoundReport } from "./found-report.service";

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
