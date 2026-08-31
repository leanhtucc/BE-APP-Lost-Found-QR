import { Request, Response, Router } from "express";
import { ENV } from "./config/env";
import aiRoutes from "./modules/ai/ai.routes";
import authRoutes from "./modules/auth/auth.routes";
import homeRoutes from "./modules/home/home.routes";
import itemRoutes from "./modules/item/item.routes";
import mapRoutes from "./modules/map/map.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import reportRoutes from "./modules/report/report.routes";
import streamRoutes from "./modules/stream/stream.routes";
import uploadRoutes from "./modules/upload/upload.routes";
import radarRoutes from "./modules/radar/radar.routes";
import { prisma } from "./libs/prisma";
import { validate } from "./middlewares/validate.middleware";
import { reportController } from "./modules/report/report.controller";
import { webhookPaymentSchema } from "./modules/report/report.schema";

/**
 * Application Routes
 * Tập trung tất cả routes của ứng dụng
 */

const router = Router();

// Root route
router.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/health/live", (_req: Request, res: Response) => {
  res.json({ success: true, status: "alive" });
});

router.get("/health/ready", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, status: "ready", database: "connected" });
  } catch {
    res.status(503).json({
      success: false,
      status: "not_ready",
      database: "disconnected",
    });
  }
});

// API Routes
router.use(`${ENV.API_PREFIX}/auth`, authRoutes);
router.use(`${ENV.API_PREFIX}/upload`, uploadRoutes);
router.use(`${ENV.API_PREFIX}/stream`, streamRoutes);
router.use(`${ENV.API_PREFIX}/map`, mapRoutes);
router.use(`${ENV.API_PREFIX}/notifications`, notificationRoutes);
router.use(`${ENV.API_PREFIX}/home`, homeRoutes);
router.use(`${ENV.API_PREFIX}/reports`, reportRoutes);
router.use(`${ENV.API_PREFIX}/radar`, radarRoutes);
router.use(ENV.API_PREFIX, itemRoutes); // Item routes (/items, /scan)

// v1 contract routes
router.use("/v1/ai", aiRoutes);
router.use("/v1/reports", reportRoutes);
// Gateway-only endpoint. Payment status changes are accepted exclusively here,
// after VNPay's signature and amount have been verified by ReportService.
router.post(
  "/v1/payments/vnpay/webhook",
  validate(webhookPaymentSchema),
  reportController.paymentWebhook
);
router.use("/v1/map", mapRoutes);
router.use("/v1/notifications", notificationRoutes);
router.use("/v1/radar", radarRoutes);

export default router;
