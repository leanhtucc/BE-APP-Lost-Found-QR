import { Router } from "express";
import { ItemsController } from "./items.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createItemSchema,
  updateItemStatusSchema,
  getItemSchema,
} from "./items.schema";

/**
 * Items Routes
 */

const router = Router();
const itemsController = new ItemsController();

// Public routes
router.get("/:itemId", validate(getItemSchema), itemsController.getItem);

// Protected routes
router.post(
  "/",
  authMiddleware,
  validate(createItemSchema),
  itemsController.createItem
);

router.get("/", authMiddleware, itemsController.getMyItems);

router.patch(
  "/:itemId/status",
  authMiddleware,
  validate(updateItemStatusSchema),
  itemsController.updateStatus
);

router.delete("/:itemId", authMiddleware, itemsController.deleteItem);

export default router;
