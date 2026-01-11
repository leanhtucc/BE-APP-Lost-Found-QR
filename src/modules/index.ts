import { Router } from "express";
import authRoutes from "./auth/auth.routes";
import itemRoutes from "./item/item.routes";
import uploadRoutes from "./upload/upload.routes";

/**
 * Export all module routes
 */

const router = Router();

router.use("/auth", authRoutes);
router.use("/upload", uploadRoutes);

// Item routes (bao gồm cả /items và /scan)
router.use(itemRoutes);

export default router;
