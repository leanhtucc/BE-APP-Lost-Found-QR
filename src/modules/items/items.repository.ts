import { prisma } from "../../libs/prisma";
import { Item } from "@prisma/client";

/**
 * Items Repository
 * Data access layer for items
 */

export class ItemsRepository {
  async create(data: {
    itemId: string;
    ownerId: string;
    name: string;
    category: string;
    description?: string;
    lostMessage?: string;
    status: string;
    qrCodeUrl: string;
    securityToken: string;
  }) {
    return prisma.item.create({
      data,
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
            photoURL: true,
          },
        },
      },
    });
  }

  async findByItemId(itemId: string) {
    return prisma.item.findUnique({
      where: { itemId },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.item.findUnique({
      where: { id },
    });
  }

  async findByOwnerId(ownerId: string) {
    return prisma.item.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(itemId: string, data: Partial<Item>) {
    return prisma.item.update({
      where: { itemId },
      data,
    });
  }

  async delete(itemId: string) {
    return prisma.item.delete({
      where: { itemId },
    });
  }

  async count(ownerId: string) {
    return prisma.item.count({
      where: { ownerId },
    });
  }
}
