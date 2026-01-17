"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.itemService = exports.ItemService = void 0;
const nanoid_1 = require("nanoid");
const env_1 = require("../../config/env");
const logger_1 = require("../../libs/logger");
const error_middleware_1 = require("../../middlewares/error.middleware");
const item_repository_1 = require("./item.repository");
/**
 * Item Service
 * Business logic cho Item module
 */
const itemRepository = new item_repository_1.ItemRepository();
class ItemService {
    // Format response
    formatItemResponse(item) {
        return {
            id: item.id,
            itemId: item.itemId,
            ownerId: item.ownerId,
            name: item.name,
            category: item.category,
            description: item.description,
            status: item.status,
            lostMessage: item.lostMessage,
            qrCodeUrl: item.qrCodeUrl,
            imagePublicUrl: item.imagePublicUrl,
            lastSeenLocation: item.lastSeenLocation,
            securityPin: item.securityPin,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        };
    }
    // Tạo item mới
    async createItem(userId, data) {
        try {
            // Generate unique IDs
            const itemId = (0, nanoid_1.nanoid)(16);
            const securityToken = (0, nanoid_1.nanoid)(32);
            const qrCodeUrl = `${env_1.ENV.APP_BASE_URL}/scan/${itemId}`;
            // Validate security PIN if provided
            if (data.securityPin && !/^\d{4}$/.test(data.securityPin)) {
                throw new error_middleware_1.AppError("Security PIN must be 4 digits", 400);
            }
            // Validate location JSON if provided
            if (data.lastSeenLocation) {
                try {
                    const location = JSON.parse(data.lastSeenLocation);
                    if (typeof location.lat !== "number" ||
                        typeof location.lng !== "number") {
                        throw new Error("Invalid location format");
                    }
                }
                catch {
                    throw new error_middleware_1.AppError("lastSeenLocation must be valid JSON with lat and lng", 400);
                }
            }
            const item = await itemRepository.createItem({
                ...data,
                ownerId: userId,
                itemId,
                securityToken,
                qrCodeUrl,
            });
            logger_1.logger.info(`Item created: ${item.itemId} by user ${userId}`);
            return this.formatItemResponse(item);
        }
        catch (error) {
            if (error instanceof error_middleware_1.AppError)
                throw error;
            logger_1.logger.error("Create item error:", error);
            throw new error_middleware_1.AppError("Failed to create item", 500);
        }
    }
    // Lấy thông tin item (chỉ owner)
    async getItem(itemId, userId) {
        const item = await itemRepository.findById(itemId);
        if (!item) {
            throw new error_middleware_1.AppError("Item not found", 404);
        }
        if (item.ownerId !== userId) {
            throw new error_middleware_1.AppError("You don't have permission to view this item", 403);
        }
        return this.formatItemResponse(item);
    }
    // Quét QR code (public endpoint)
    async scanQRCode(itemId) {
        const item = await itemRepository.findByItemId(itemId);
        if (!item) {
            throw new error_middleware_1.AppError("Item not found", 404);
        }
        const ownerInfo = {
            display_name: item.owner.displayName,
            avatar: item.owner.photoURL || "",
            joined_date: new Date(item.owner.createdAt).getFullYear().toString(),
        };
        // Nếu status là "safe"
        if (item.status === "safe") {
            return {
                item_info: {
                    id: item.itemId,
                    name: item.name,
                    category: item.category,
                    status: item.status,
                    description: item.description || undefined,
                    image_url: item.imagePublicUrl || undefined,
                    owner_info: ownerInfo,
                },
                action: "info_only",
                message: "This item is not reported as lost",
            };
        }
        // Nếu status là "lost"
        return {
            item_info: {
                id: item.itemId,
                name: item.name,
                category: item.category,
                status: item.status,
                description: item.description || undefined,
                lost_message: item.lostMessage || undefined,
                image_url: item.imagePublicUrl || undefined,
                owner_info: ownerInfo,
            },
            action: "open_chat",
        };
    }
    // Lấy danh sách items của user
    async listItems(userId, query) {
        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;
        const { items, total } = await itemRepository.findByOwnerId(userId, {
            status: query.status || undefined,
            category: query.category || undefined,
            skip,
            take: limit,
        });
        return {
            items: items.map((item) => this.formatItemResponse(item)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    // Cập nhật item
    async updateItem(itemId, userId, data) {
        const item = await itemRepository.findById(itemId);
        if (!item) {
            throw new error_middleware_1.AppError("Item not found", 404);
        }
        if (item.ownerId !== userId) {
            throw new error_middleware_1.AppError("You don't have permission to update this item", 403);
        }
        // Validate security PIN if provided
        if (data.securityPin && !/^\d{4}$/.test(data.securityPin)) {
            throw new error_middleware_1.AppError("Security PIN must be 4 digits", 400);
        }
        // Validate location JSON if provided
        if (data.lastSeenLocation) {
            try {
                const location = JSON.parse(data.lastSeenLocation);
                if (typeof location.lat !== "number" ||
                    typeof location.lng !== "number") {
                    throw new Error("Invalid location format");
                }
            }
            catch {
                throw new error_middleware_1.AppError("lastSeenLocation must be valid JSON with lat and lng", 400);
            }
        }
        const updated = await itemRepository.updateItem(itemId, data);
        logger_1.logger.info(`Item updated: ${item.itemId} by user ${userId}`);
        return this.formatItemResponse(updated);
    }
    // Xóa item
    async deleteItem(itemId, userId) {
        const item = await itemRepository.findById(itemId);
        if (!item) {
            throw new error_middleware_1.AppError("Item not found", 404);
        }
        if (item.ownerId !== userId) {
            throw new error_middleware_1.AppError("You don't have permission to delete this item", 403);
        }
        await itemRepository.deleteItem(itemId);
        logger_1.logger.info(`Item deleted: ${item.itemId} by user ${userId}`);
    }
    // Thay đổi trạng thái item (lost/safe)
    async updateStatus(itemId, userId, status, lostMessage) {
        const item = await itemRepository.findById(itemId);
        if (!item) {
            throw new error_middleware_1.AppError("Item not found", 404);
        }
        if (item.ownerId !== userId) {
            throw new error_middleware_1.AppError("You don't have permission to update item status", 403);
        }
        const updateData = { status };
        if (status === "lost" && lostMessage) {
            updateData.lostMessage = lostMessage;
        }
        const updated = await itemRepository.updateItem(itemId, updateData);
        logger_1.logger.info(`Item status changed to ${status}: ${item.itemId} by user ${userId}`);
        return this.formatItemResponse(updated);
    }
}
exports.ItemService = ItemService;
exports.itemService = new ItemService();
//# sourceMappingURL=item.service.js.map