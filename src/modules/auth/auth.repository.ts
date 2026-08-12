import { prisma } from "../../libs/prisma";

/**
 * Auth Repository
 * Data access layer for users
 */

export class AuthRepository {
  async createUser(data: {
    uid: string;
    email: string;
    password: string;
    displayName: string;
    photoURL?: string;
    phoneNumber?: string;
    verificationCode?: string;
    verificationCodeExpiry?: Date;
    isVerified?: boolean;
    googleId?: string;
    bio?: string;
    addressCity?: string;
  }) {
    return prisma.user.create({
      data: {
        ...data,
        memberId: `USER_${data.uid.replace("user_", "")}`, // Generate memberId
      },
      select: {
        id: true,
        uid: true,
        memberId: true,
        email: true,
        displayName: true,
        photoURL: true,
        phoneNumber: true,
        trustScore: true,
        totalReturned: true,
        itemsLost: true,
        addressCity: true,
        bio: true,
        isVerified: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    return prisma.user.findFirst({
      where: { phoneNumber },
    });
  }

  async updateLastLogin(id: string) {
    return prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  async findByGoogleId(googleId: string) {
    return prisma.user.findUnique({
      where: { googleId },
    });
  }

  async findByUid(uid: string) {
    return prisma.user.findUnique({
      where: { uid },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        uid: true,
        memberId: true,
        email: true,
        displayName: true,
        photoURL: true,
        phoneNumber: true,
        trustScore: true,
        totalReturned: true,
        itemsLost: true,
        addressCity: true,
        bio: true,
        isVerified: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateUser(
    id: string,
    data: {
      displayName?: string;
      photoURL?: string;
      phoneNumber?: string;
      pushToken?: string;
      bio?: string;
      addressCity?: string;
      privacySettings?: object;
      isVerified?: boolean;
      googleId?: string;
      resetPasswordToken?: string | null;
      resetPasswordExpiry?: Date | null;
    }
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        uid: true,
        memberId: true,
        email: true,
        displayName: true,
        photoURL: true,
        phoneNumber: true,
        trustScore: true,
        totalReturned: true,
        itemsLost: true,
        addressCity: true,
        bio: true,
        isVerified: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async countByEmail(email: string) {
    return prisma.user.count({
      where: { email },
    });
  }

  async findByResetToken(token: string) {
    return prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: {
          gt: new Date(), // Token chưa hết hạn
        },
      },
    });
  }

  async updatePassword(id: string, hashedPassword: string) {
    return prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null, // Xóa token sau khi đặt lại mật khẩu
        resetPasswordExpiry: null,
      },
    });
  }
}
