import { Router } from "express";
import itemsRoutes from "./items/items.routes";
import authRoutes from "./auth/auth.routes";
import uploadRoutes from "./upload/upload.routes";

/**
 * Export all module routes
 */

const router = Router();

router.use("/items", itemsRoutes);
router.use("/auth", authRoutes);
router.use("/upload", uploadRoutes);

export default router;
