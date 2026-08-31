import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { reportController } from "./report.controller";
import {
  createReportSchema,
  reportIdParamSchema,
  webhookPaymentSchema,
} from "./report.schema";

const router = Router();

// POST /v1/reports  (also mounted at /api/reports)
router.post(
  "/",
  authMiddleware,
  validate(createReportSchema),
  reportController.createReport
);

router.get(
  "/:reportId/status",
  authMiddleware,
  validate(reportIdParamSchema),
  reportController.getReportStatus
);

router.post(
  "/:reportId/payment-session",
  authMiddleware,
  validate(reportIdParamSchema),
  reportController.paymentSession
);

// Backward-compat alias kept for existing FE calls
router.post(
  "/lost-item",
  authMiddleware,
  validate(createReportSchema),
  reportController.createReport
);

// POST /api/reports/webhook/payment  (no auth – called by 3rd-party gateway)
router.post(
  "/webhook/payment",
  validate(webhookPaymentSchema),
  reportController.paymentWebhook
);

export default router;
