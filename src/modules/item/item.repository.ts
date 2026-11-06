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
      qrCodeId: string;
      securityToken: string;
      status?: "SAFE" | "LOST" | "FOUND" | "RESOLVED";
      latitude?: number | null;
      longitude?: number | null;
      lastSeenLocation?: string | null;
      locationGeoHash?: string | null;
      captureLatitude?: number | null;
      captureLongitude?: number | null;
      captureAddress?: string | null;
      captureAccuracyMeters?: number | null;
      capturedAt?: Date | null;
    }
  ) {
    const { captureLocation, address, ...cleanData } = data as any;
    return await prisma.item.create({
      data: cleanData,
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

  // Tìm item theo bất kỳ định danh nào: id (cuid PK), itemId (cuid unique), qrCodeId (unique)
  async findByIdentifier(identifier: string) {
    return await prisma.item.findFirst({
      where: {
        OR: [
          { id: identifier },
          { itemId: identifier },
          { qrCodeId: identifier },
        ],
      },
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
          where: { status: { in: ["ACTIVE", "FOUND"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
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

  // Tìm item theo qrCodeId (để quét QR)
  async findByQrCodeId(qrCodeId: string) {
    return await prisma.item.findUnique({
      where: { qrCodeId },
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
          where: { status: { in: ["ACTIVE", "FOUND"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async recordQrScan(itemId: string) {
    return prisma.qrScan.create({ data: { itemId } });
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
    const {
      captureLocation,
      address,
      lastSeenLocation,
      latitude,
      longitude,
      ...cleanData
    } = data as any;
    return await prisma.item.update({
      where: { id },
      data: cleanData,
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

  async markLost(
    id: string,
    ownerId: string,
    data: {
      lostMessage?: string;
      lostAddress?: string;
      latitude: number;
      longitude: number;
      geohash: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const transition = await tx.item.updateMany({
        where: {
          id,
          ownerId,
          status: "SAFE",
          posts: {
            none: { status: { in: ["PENDING_PAYMENT", "ACTIVE"] } },
          },
        },
        data: {
          status: "LOST",
          lostMessage: data.lostMessage || null,
          lostAddress: data.lostAddress || null,
          lostLat: data.latitude,
          lostLng: data.longitude,
          latitude: data.latitude,
          longitude: data.longitude,
          locationGeoHash: data.geohash,
          locationUpdatedAt: new Date(),
        },
      });

      if (transition.count !== 1) return null;

      await tx.$executeRaw`
        UPDATE "Item"
        SET "location" = ST_SetSRID(
          ST_MakePoint(${data.longitude}, ${data.latitude}),
          4326
        )::geography
        WHERE "id" = ${id}
      `;

      return tx.item.findUnique({
        where: { id },
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
    });
  }

  async markSafe(id: string, ownerId: string) {
    return prisma.$transaction(async (tx) => {
      const transition = await tx.item.updateMany({
        where: {
          id,
          ownerId,
          // Only a LOST item can be taken back to SAFE. FOUND (return in
          // progress) and RESOLVED (already returned) must not be reverted.
          status: "LOST",
        },
        data: {
          status: "SAFE",
          lostMessage: null,
          lostAddress: null,
          lostLat: null,
          lostLng: null,
          latitude: null,
          longitude: null,
          locationGeoHash: null,
          locationUpdatedAt: null,
        },
      });

      if (transition.count !== 1) return null;

      // Keep the Item and any open Guardian payment/escrow state consistent.
      // A failure in any of these writes rolls the SAFE transition back too.
      const openReport = await tx.post.findFirst({
        where: {
          itemId: id,
          ownerId,
          status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (openReport) {
        await tx.post.update({
          where: { id: openReport.id },
          data: { status: "CANCELLED" },
        });
        await tx.payment.updateMany({
          where: { reportId: openReport.id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
        await tx.escrowTransaction.updateMany({
          where: { postId: openReport.id, status: "HOLDING" },
          data: { status: "REFUNDED" },
        });
      }

      await tx.$executeRaw`
        UPDATE "Item"
        SET "location" = NULL
        WHERE "id" = ${id}
      `;

      return tx.item.findUnique({
        where: { id },
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
        { qrCodeId: { contains: options.query, mode: "insensitive" } },
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
        prisma.item.count({ where: { ownerId, status: "SAFE" } }),
        prisma.item.count({ where: { ownerId, status: "LOST" } }),
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
