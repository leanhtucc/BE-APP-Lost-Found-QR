import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { reportController } from "./report.controller";
import { reportLostItemSchema, webhookPaymentSchema } from "./report.schema";

const router = Router();

// POST /api/reports/lost-item
router.post(
  "/lost-item",
  authMiddleware,
  validate(reportLostItemSchema),
  reportController.createReport
);

// POST /api/reports/webhook/payment
// Usually webhooks don't have user authentication as they come from 3rd party gateways.
router.post(
  "/webhook/payment",
  validate(webhookPaymentSchema),
  reportController.paymentWebhook
);

export default router;
