import { Request, Response, Router } from "express";
import { ENV } from "./config/env";
import authRoutes from "./modules/auth/auth.routes";
import itemRoutes from "./modules/item/item.routes";
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
router.use(ENV.API_PREFIX, itemRoutes); // Item routes bao gồm /items và /scan

export default router;
