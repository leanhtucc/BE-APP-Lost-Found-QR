"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemRepository = void 0;
const prisma_1 = require("../../libs/prisma");
/**
 * Item Repository
 * Database access layer cho Item
 */
class ItemRepository {
    // Tạo item mới
    async createItem(data) {
        return await prisma_1.prisma.item.create({
            data,
            include: {
                owner: {
                    select: {
                        id: true,
                        uid: true,
                        displayName: true,
                        email: true,
                        photoURL: true,
                        createdAt: true,
                    },
                },
            },
        });
    }
    // Tìm item theo ID
    async findById(id) {
        return await prisma_1.prisma.item.findUnique({
            where: { id },
            include: {
                owner: {
                    select: {
                        id: true,
                        uid: true,
                        displayName: true,
                        email: true,
                        photoURL: true,
                        createdAt: true,
                    },
                },
            },
        });
    }
    // Tìm item theo itemId (để quét QR)
    async findByItemId(itemId) {
        return await prisma_1.prisma.item.findUnique({
            where: { itemId },
            include: {
                owner: {
                    select: {
                        id: true,
                        uid: true,
                        displayName: true,
                        email: true,
                        photoURL: true,
                        createdAt: true,
                    },
                },
            },
        });
    }
    // Tìm item theo securityToken
    async findBySecurityToken(securityToken) {
        return await prisma_1.prisma.item.findUnique({
            where: { securityToken },
            include: {
                owner: {
                    select: {
                        id: true,
                        uid: true,
                        displayName: true,
                        email: true,
                        photoURL: true,
                        createdAt: true,
                    },
                },
            },
        });
    }
    // Lấy danh sách items của user với pagination và filter
    async findByOwnerId(ownerId, options) {
        const where = { ownerId };
        if (options.status && options.status !== "all") {
            where.status = options.status;
        }
        if (options.category) {
            where.category = options.category;
        }
        const [items, total] = await Promise.all([
            prisma_1.prisma.item.findMany({
                where,
                skip: options.skip,
                take: options.take,
                orderBy: { createdAt: "desc" },
                include: {
                    owner: {
                        select: {
                            id: true,
                            uid: true,
                            displayName: true,
                            email: true,
                            photoURL: true,
                        },
                    },
                },
            }),
            prisma_1.prisma.item.count({ where }),
        ]);
        return { items, total };
    }
    // Cập nhật item
    async updateItem(id, data) {
        return await prisma_1.prisma.item.update({
            where: { id },
            data,
            include: {
                owner: {
                    select: {
                        id: true,
                        uid: true,
                        displayName: true,
                        email: true,
                        photoURL: true,
                    },
                },
            },
        });
    }
    // Xóa item
    async deleteItem(id) {
        return await prisma_1.prisma.item.delete({
            where: { id },
        });
    }
    // Đếm số items của user
    async countByOwnerId(ownerId) {
        return await prisma_1.prisma.item.count({
            where: { ownerId },
        });
    }
    // Kiểm tra item có thuộc user không
    async isOwner(itemId, ownerId) {
        const item = await prisma_1.prisma.item.findUnique({
            where: { id: itemId },
            select: { ownerId: true },
        });
        return item?.ownerId === ownerId;
    }
}
exports.ItemRepository = ItemRepository;
//# sourceMappingURL=item.repository.js.map