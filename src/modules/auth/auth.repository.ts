import { User } from "@prisma/client";
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
    verificationCode?: string;
    verificationCodeExpiry?: Date;
    isVerified?: boolean;
  }) {
    return prisma.user.create({
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

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
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
        email: true,
        displayName: true,
        photoURL: true,
        totalReturned: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateUser(id: string, data: Partial<User>) {
    return prisma.user.update({
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
}
