"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const prisma_1 = require("../../libs/prisma");
/**
 * Auth Repository
 * Data access layer for users
 */
class AuthRepository {
    async createUser(data) {
        return prisma_1.prisma.user.create({
            data,
            select: {
                id: true,
                uid: true,
                email: true,
                displayName: true,
                photoURL: true,
                totalReturned: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    async findByEmail(email) {
        return prisma_1.prisma.user.findUnique({
            where: { email },
        });
    }
    async findByGoogleId(googleId) {
        return prisma_1.prisma.user.findUnique({
            where: { googleId },
        });
    }
    async findByUid(uid) {
        return prisma_1.prisma.user.findUnique({
            where: { uid },
        });
    }
    async findById(id) {
        return prisma_1.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                uid: true,
                email: true,
                displayName: true,
                photoURL: true,
                totalReturned: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    async updateUser(id, data) {
        return prisma_1.prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                uid: true,
                email: true,
                displayName: true,
                photoURL: true,
                totalReturned: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    async deleteUser(id) {
        return prisma_1.prisma.user.delete({
            where: { id },
        });
    }
    async countByEmail(email) {
        return prisma_1.prisma.user.count({
            where: { email },
        });
    }
    async findByResetToken(token) {
        return prisma_1.prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpiry: {
                    gt: new Date(), // Token chưa hết hạn
                },
            },
        });
    }
    async updatePassword(id, hashedPassword) {
        return prisma_1.prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null, // Xóa token sau khi đặt lại mật khẩu
                resetPasswordExpiry: null,
            },
        });
    }
}
exports.AuthRepository = AuthRepository;
//# sourceMappingURL=auth.repository.js.map