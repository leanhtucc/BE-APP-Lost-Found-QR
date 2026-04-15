import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ItemController } from "./item.controller";
import {
  createItemSchema,
  itemIdParamSchema,
  listItemsSchema,
  scanQRSchema,
  searchItemsSchema,
  updateItemSchema,
  updateStatusSchemaWithCoordinates,
} from "./item.schema";

/**
 * Item Routes
 */

const router = Router();
const itemController = new ItemController();

// Public routes
// GET /api/scan/:itemId - Quét QR code (không cần auth)
router.get("/scan/:itemId", validate(scanQRSchema), itemController.scanQRCode);

// Protected routes (cần authentication)
// POST /api/items - Tạo item mới
router.post(
  "/items",
  authMiddleware,
  validate(createItemSchema),
  itemController.createItem
);

// GET /api/items - Lấy danh sách items của user
router.get(
  "/items",
  authMiddleware,
  validate(listItemsSchema),
  itemController.listItems
);

// GET /api/items/categories - Lấy danh sách categories
router.get("/items/categories", authMiddleware, itemController.getCategories);

// GET /api/items/search - Tìm kiếm items (PHẢI ĐẶT TRƯỚC /items/:id)
router.get(
  "/items/search",
  authMiddleware,
  validate(searchItemsSchema),
  itemController.searchItems
);

// GET /api/items/summary - Lấy thống kê dashboard (PHẢI ĐẶT TRƯỚC /items/:id)
router.get(
  "/items/summary",
  authMiddleware,
  itemController.getDashboardSummary
);

// GET /api/items/:id - Lấy thông tin 1 item
router.get(
  "/items/:id",
  authMiddleware,
  validate(itemIdParamSchema),
  itemController.getItem
);

// PATCH /api/items/:id - Cập nhật item
router.patch(
  "/items/:id",
  authMiddleware,
  validate(itemIdParamSchema),
  validate(updateItemSchema),
  itemController.updateItem
);

// DELETE /api/items/:id - Xóa item
router.delete(
  "/items/:id",
  authMiddleware,
  validate(itemIdParamSchema),
  itemController.deleteItem
);

// PATCH /api/items/:id/status - Cập nhật trạng thái (lost/safe)
router.patch(
  "/items/:id/status",
  authMiddleware,
  validate(itemIdParamSchema),
  validate(updateStatusSchemaWithCoordinates),
  itemController.updateStatus
);

export default router;
