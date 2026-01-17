"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const item_controller_1 = require("./item.controller");
const item_schema_1 = require("./item.schema");
/**
 * Item Routes
 */
const router = (0, express_1.Router)();
const itemController = new item_controller_1.ItemController();
// Public routes
// GET /api/scan/:itemId - Quét QR code (không cần auth)
router.get("/scan/:itemId", (0, validate_middleware_1.validate)(item_schema_1.scanQRSchema), itemController.scanQRCode);
// Protected routes (cần authentication)
// POST /api/items - Tạo item mới
router.post("/items", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(item_schema_1.createItemSchema), itemController.createItem);
// GET /api/items - Lấy danh sách items của user
router.get("/items", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(item_schema_1.listItemsSchema), itemController.listItems);
// GET /api/items/:id - Lấy thông tin 1 item
router.get("/items/:id", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(item_schema_1.itemIdParamSchema), itemController.getItem);
// PATCH /api/items/:id - Cập nhật item
router.patch("/items/:id", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(item_schema_1.itemIdParamSchema), (0, validate_middleware_1.validate)(item_schema_1.updateItemSchema), itemController.updateItem);
// DELETE /api/items/:id - Xóa item
router.delete("/items/:id", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(item_schema_1.itemIdParamSchema), itemController.deleteItem);
// PATCH /api/items/:id/status - Cập nhật trạng thái (lost/safe)
router.patch("/items/:id/status", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(item_schema_1.itemIdParamSchema), (0, validate_middleware_1.validate)(item_schema_1.updateStatusSchema), itemController.updateStatus);
exports.default = router;
//# sourceMappingURL=item.routes.js.map