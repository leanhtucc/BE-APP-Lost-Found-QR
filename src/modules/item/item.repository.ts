import { prisma } from "../../libs/prisma";
import { CreateItemDTO, UpdateItemDTO } from "./item.types";

/**
 * Item Repository
 * Database access layer cho Item
 */

export class ItemRepository {
  // Tạo item mới
  async createItem(
    data: CreateItemDTO & {
      ownerId: string;
      itemId: string;
      securityToken: string;
      qrCodeUrl: string;
    }
  ) {
    return await prisma.item.create({
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
  async findById(id: string) {
    return await prisma.item.findUnique({
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
  async findByItemId(itemId: string) {
    return await prisma.item.findUnique({
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
  async findBySecurityToken(securityToken: string) {
    return await prisma.item.findUnique({
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
  async findByOwnerId(
    ownerId: string,
    options: {
      status?: string;
      category?: string;
      skip: number;
      take: number;
    }
  ) {
    const where: any = { ownerId };

    if (options.status && options.status !== "all") {
      where.status = options.status;
    }

    if (options.category) {
      where.category = options.category;
    }

    const [items, total] = await Promise.all([
      prisma.item.findMany({
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
      prisma.item.count({ where }),
    ]);

    return { items, total };
  }

  // Cập nhật item
  async updateItem(id: string, data: UpdateItemDTO) {
    return await prisma.item.update({
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
  async deleteItem(id: string) {
    return await prisma.item.delete({
      where: { id },
    });
  }

  // Đếm số items của user
  async countByOwnerId(ownerId: string) {
    return await prisma.item.count({
      where: { ownerId },
    });
  }

  // Kiểm tra item có thuộc user không
  async isOwner(itemId: string, ownerId: string): Promise<boolean> {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { ownerId: true },
    });
    return item?.ownerId === ownerId;
  }
}
