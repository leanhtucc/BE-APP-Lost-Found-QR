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
            phoneNumber: true,
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
            phoneNumber: true,
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
            phoneNumber: true,
            createdAt: true,
            memberId: true,
          },
        },
        posts: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
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
            phoneNumber: true,
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
              phoneNumber: true,
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

  // Cập nhật geospatial location cho Live Radar
  async updateItemGeoPoint(
    itemId: string,
    latitude: number,
    longitude: number,
    geohash: string
  ) {
    await prisma.$executeRaw`
      UPDATE "Item"
      SET
        "latitude" = ${latitude},
        "longitude" = ${longitude},
        "location_geohash" = ${geohash},
        "location_updated_at" = NOW(),
        "location" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
        "updatedAt" = NOW()
      WHERE "id" = ${itemId};
    `;
  }

  // Xóa geospatial location (khi item trở lại trạng thái safe)
  async clearItemGeoPoint(itemId: string) {
    await prisma.$executeRaw`
      UPDATE "Item"
      SET
        "latitude" = NULL,
        "longitude" = NULL,
        "location_geohash" = NULL,
        "location_updated_at" = NULL,
        "location" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${itemId};
    `;
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

  // Tìm kiếm items theo keyword
  async searchItems(
    ownerId: string,
    options: {
      query: string;
      status?: string;
      category?: string;
      skip: number;
      take: number;
    }
  ) {
    const where: any = {
      ownerId,
      OR: [
        { name: { contains: options.query, mode: "insensitive" } },
        { description: { contains: options.query, mode: "insensitive" } },
        { category: { contains: options.query, mode: "insensitive" } },
        { itemId: { contains: options.query, mode: "insensitive" } },
      ],
    };

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
              phoneNumber: true,
            },
          },
        },
      }),
      prisma.item.count({ where }),
    ]);

    return { items, total };
  }

  // Lấy thống kê dashboard
  async getDashboardStats(ownerId: string) {
    const [totalItems, safeItems, lostItems, categoryCounts, recentItems] =
      await Promise.all([
        prisma.item.count({ where: { ownerId } }),
        prisma.item.count({ where: { ownerId, status: "safe" } }),
        prisma.item.count({ where: { ownerId, status: "lost" } }),
        prisma.item.groupBy({
          by: ["category"],
          where: { ownerId },
          _count: { category: true },
        }),
        prisma.item.findMany({
          where: { ownerId },
          take: 5,
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
      ]);

    return {
      totalItems,
      safeItems,
      lostItems,
      categoryCounts: categoryCounts.map((c) => ({
        category: c.category,
        count: c._count.category,
      })),
      recentItems,
    };
  }
}
