import { Request, Response, Router } from "express";
import { ENV } from "./config/env";
import authRoutes from "./modules/auth/auth.routes";
import homeRoutes from "./modules/home/home.routes";
import itemRoutes from "./modules/item/item.routes";
import mapRoutes from "./modules/map/map.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import reportRoutes from "./modules/report/report.routes";
import streamRoutes from "./modules/stream/stream.routes";
import uploadRoutes from "./modules/upload/upload.routes";

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

// API Routes - Đăng ký trực tiếp tất cả module routes
router.use(`${ENV.API_PREFIX}/auth`, authRoutes);
router.use(`${ENV.API_PREFIX}/upload`, uploadRoutes);
router.use(`${ENV.API_PREFIX}/stream`, streamRoutes);
router.use(`${ENV.API_PREFIX}/map`, mapRoutes);
router.use(`${ENV.API_PREFIX}/notifications`, notificationRoutes);
router.use(`${ENV.API_PREFIX}/home`, homeRoutes);
router.use(`${ENV.API_PREFIX}/reports`, reportRoutes);
router.use(ENV.API_PREFIX, itemRoutes); // Item routes bao gồm /items và /scan

// Notification v1 contract
router.use("/v1/notifications", notificationRoutes);

export default router;
