import { Router, Request, Response } from "express";
import apiRoutes from "./modules";
import { ENV } from "./config/env";

/**
 * Application Routes
 * Tập trung tất cả routes của ứng dụng
 */

const router = Router();

// Health check routes
router.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Lost & Found API is running 🚀",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

router.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    environment: ENV.NODE_ENV,
  });
});

// API Routes
router.use(ENV.API_PREFIX, apiRoutes);

export default router;
