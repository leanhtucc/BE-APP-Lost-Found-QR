"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemController = void 0;
const response_1 = require("../../utils/response");
const item_service_1 = require("./item.service");
/**
 * Item Controller
 * Handle Item HTTP requests
 */
const itemService = new item_service_1.ItemService();
class ItemController {
    // POST /api/items - Tạo item mới
    async createItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { name, category, description, imagePublicUrl, lastSeenLocation, securityPin, } = req.query;
            const result = await itemService.createItem(userId, {
                name,
                category,
                description,
                imagePublicUrl,
                lastSeenLocation,
                securityPin,
            });
            return response_1.ResponseUtil.created(res, result, "Item created successfully");
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/items/:id - Lấy thông tin item
    async getItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            if (!id) {
                return response_1.ResponseUtil.badRequest(res, "Item ID is required");
            }
            const result = await itemService.getItem(id, userId);
            return response_1.ResponseUtil.success(res, result);
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/items - Lấy danh sách items của user
    async listItems(req, res, next) {
        try {
            const userId = req.user.id;
            const { status, category, page, limit } = req.query;
            const result = await itemService.listItems(userId, {
                status,
                category,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 10,
            });
            return response_1.ResponseUtil.success(res, result);
        }
        catch (error) {
            next(error);
        }
    }
    // PATCH /api/items/:id - Cập nhật item
    async updateItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { name, category, description, status, lostMessage, imagePublicUrl, lastSeenLocation, securityPin, } = req.query;
            if (!id) {
                return response_1.ResponseUtil.badRequest(res, "Item ID is required");
            }
            const result = await itemService.updateItem(id, userId, {
                name,
                category,
                description,
                status,
                lostMessage,
                imagePublicUrl,
                lastSeenLocation,
                securityPin,
            });
            return response_1.ResponseUtil.success(res, result, "Item updated successfully");
        }
        catch (error) {
            next(error);
        }
    }
    // DELETE /api/items/:id - Xóa item
    async deleteItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            if (!id) {
                return response_1.ResponseUtil.badRequest(res, "Item ID is required");
            }
            await itemService.deleteItem(id, userId);
            return response_1.ResponseUtil.success(res, null, "Item deleted successfully");
        }
        catch (error) {
            next(error);
        }
    }
    // PATCH /api/items/:id/status - Cập nhật trạng thái item
    async updateStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { status, lostMessage } = req.query;
            if (!id) {
                return response_1.ResponseUtil.badRequest(res, "Item ID is required");
            }
            const result = await itemService.updateStatus(id, userId, status, lostMessage);
            return response_1.ResponseUtil.success(res, result, "Status updated successfully");
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/scan/:itemId - Quét QR code (Public endpoint)
    async scanQRCode(req, res, next) {
        try {
            const { itemId } = req.params;
            if (!itemId) {
                return response_1.ResponseUtil.badRequest(res, "Item ID is required");
            }
            const result = await itemService.scanQRCode(itemId);
            return response_1.ResponseUtil.success(res, result);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ItemController = ItemController;
//# sourceMappingURL=item.controller.js.map