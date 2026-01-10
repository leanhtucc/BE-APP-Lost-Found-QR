import { Router } from "express";
import itemsRoutes from "./items/items.routes";
import authRoutes from "./auth/auth.routes";

/**
 * Export all module routes
 */

const router = Router();

router.use("/items", itemsRoutes);
router.use("/auth", authRoutes);

export default router;
