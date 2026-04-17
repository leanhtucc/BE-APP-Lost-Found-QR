import { nanoid } from "nanoid";
import { ENV } from "../../config/env";
import { logger } from "../../libs/logger";
import { prisma } from "../../libs/prisma";
import {
  createItemChannel,
  createStreamUserToken,
  upsertStreamUser,
} from "../../libs/stream-chat";
import { AppError } from "../../middlewares/error.middleware";
import { emitLostItemToNearbyUsers } from "../../socket/radar.socket";
import { encodeGeoHash, haversineDistanceMeters } from "../../utils/geospatial";
import { notificationService } from "../notification/notification.service";
import { reportService } from "../report/report.service";
import { ItemRepository } from "./item.repository";
import {
  CreateItemDTO,
  DashboardSummary,
  ITEM_CATEGORIES,
  ItemResponse,
  ListItemsQuery,
  ListItemsResponse,
  ScanQRResponse,
  SearchItemsQuery,
  SearchItemsResponse,
  UpdateItemDTO,
} from "./item.types";

/**
 * Item Service
 * Business logic cho Item module
 */

const itemRepository = new ItemRepository();
const ITEM_GEOHASH_PRECISION = 6;

export class ItemService {
  private resolveReportedCoordinates(
    coordinates: {
      latitude?: number;
      longitude?: number;
    },
    fallbackLocation?: string | null
  ): { latitude: number; longitude: number } | null {
    const hasLatitude =
      coordinates.latitude !== undefined &&
      Number.isFinite(coordinates.latitude);
    const hasLongitude =
      coordinates.longitude !== undefined &&
      Number.isFinite(coordinates.longitude);

    if (hasLatitude !== hasLongitude) {
      throw new AppError(
        "latitude and longitude must be provided together",
        400
      );
    }

    if (hasLatitude && hasLongitude) {
      const latitude = Number(coordinates.latitude);
      const longitude = Number(coordinates.longitude);

      if (latitude < -90 || latitude > 90) {
        throw new AppError("latitude must be in range [-90, 90]", 400);
      }

      if (longitude < -180 || longitude > 180) {
        throw new AppError("longitude must be in range [-180, 180]", 400);
      }

      return { latitude, longitude };
    }

    if (!fallbackLocation) {
      return null;
    }

    try {
      const parsed = JSON.parse(fallbackLocation);

      if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return {
          latitude: parsed.lat,
          longitude: parsed.lng,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  // Format response
  private formatItemResponse(item: any): ItemResponse {
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
  async createItem(userId: string, data: CreateItemDTO): Promise<ItemResponse> {
    try {
      // Generate unique IDs
      const itemId = nanoid(16);
      const securityToken = nanoid(32);
      const qrCodeUrl = `${ENV.APP_BASE_URL}/scan/${itemId}`;

      // Validate security PIN if provided
      if (data.securityPin && !/^\d{4}$/.test(data.securityPin)) {
        throw new AppError("Security PIN must be 4 digits", 400);
      }

      // Validate location JSON if provided
      if (data.lastSeenLocation) {
        try {
          const location = JSON.parse(data.lastSeenLocation);
          if (
            typeof location.lat !== "number" ||
            typeof location.lng !== "number"
          ) {
            throw new Error("Invalid location format");
          }
        } catch {
          throw new AppError(
            "lastSeenLocation must be valid JSON with lat and lng",
            400
          );
        }
      }

      const item = await itemRepository.createItem({
        ...data,
        ownerId: userId,
        itemId,
        securityToken,
        qrCodeUrl,
      });

      logger.info(`Item created: ${item.itemId} by user ${userId}`);

      return this.formatItemResponse(item);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Create item error:", error);
      throw new AppError("Failed to create item", 500);
    }
  }

  // Lấy thông tin item (chỉ owner)
  async getItem(itemId: string, userId: string): Promise<ItemResponse> {
    const item = await itemRepository.findById(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.ownerId !== userId) {
      throw new AppError("You don't have permission to view this item", 403);
    }

    return this.formatItemResponse(item);
  }

  // Quét QR code (public endpoint)
  async scanQRCode(itemId: string): Promise<ScanQRResponse> {
    const item = await itemRepository.findByItemId(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    const shortId = (item.owner.memberId || item.owner.uid || "A3F2")
      .substring(0, 4)
      .toUpperCase();

    // Chủ nhân ẩn danh
    const ownerInfo: any = {
      display_name: `Chủ nhân ẩn danh #${shortId}`,
      avatar: "", // Khóa ảnh đại diện cho chế độ ẩn danh theo design
      joined_date: new Date(item.owner.createdAt).getFullYear().toString(),
    };

    // Nếu status là "SAFE"
    if (item.status === "SAFE") {
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

    // Lấy thông tin bounty từ Post
    let bountyAmount: number | undefined = undefined;
    let escrowStatus: string | undefined = undefined;
    // item.posts đã được include take: 1 từ Repo
    const activePost = (item as any).posts?.[0];
    if (activePost) {
      bountyAmount = activePost.bountyAmount;
      escrowStatus = "Đã khóa an toàn trong escrow";
    }

    // Nếu status là "LOST"
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
        bounty_amount: bountyAmount,
        escrow_status: escrowStatus,
      },
      action: "open_chat",
    };
  }

  // Khởi tạo Chat cho Guest (Luồng B+)
  async initGuestChat(
    itemId: string,
    phoneNumber: string,
    lat?: number,
    lng?: number
  ) {
    const item = await itemRepository.findByItemId(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.status !== "LOST") {
      throw new AppError("Item is not currently lost", 400);
    }

    // Lookup or Create Guest User
    // We will search for a user by phoneNumber. If not exists, create a guest user.
    let guestUser = await prisma.user.findFirst({
      where: { phoneNumber },
    });

    if (!guestUser) {
      const shortPhone = phoneNumber.substring(phoneNumber.length - 4);
      const guestUid = `guest_${nanoid(10)}`;
      guestUser = await prisma.user.create({
        data: {
          uid: guestUid,
          email: `${guestUid}@guest.findback.app`,
          phoneNumber,
          displayName: `Người nhặt được (*${shortPhone})`,
          role: "guest",
        },
      });
    }

    // Register guest in StreamChat
    const guestDisplayName =
      guestUser.displayName || `Guest (*${phoneNumber.slice(-4)})`;
    await upsertStreamUser({
      id: guestUser.id,
      name: guestDisplayName,
    });

    // Create StreamChat token
    const chatToken = createStreamUserToken(guestUser.id);

    // Ensure Owner is on StreamChat
    await upsertStreamUser({
      id: item.owner.id,
      name: item.owner.displayName,
    });

    // Create item channel
    const { channelId } = await createItemChannel(
      itemId,
      item.name,
      item.owner.id,
      guestUser.id
    );

    // Update item status to FOUND since someone scanned and initiated returned chat
    await itemRepository.updateItem(item.id, { status: "FOUND" });

    // Persist notification records for app inbox + in-app realtime emit.
    const notificationTasks: Promise<unknown>[] = [
      notificationService.notifyStatusUpdate({
        receiverId: item.owner.id,
        category: "ITEM",
        type: "QR_SCANNED",
        title: "Có người quét mã QR",
        content: `${guestDisplayName} đã quét QR của món đồ ${item.name}`,
        metadata: {
          item_id: itemId,
          room_id: channelId,
          finder_id: guestUser.id,
        },
      }),
      notificationService.notifyNewChat({
        receiverId: item.owner.id,
        senderAvatar: guestUser.photoURL || "",
        roomId: channelId,
        messagePreview: `${guestDisplayName} vừa bắt đầu cuộc trò chuyện về ${item.name}`,
        itemId,
      }),
    ];

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      item.lostLat != null &&
      item.lostLng != null
    ) {
      const distanceMeters = Math.round(
        haversineDistanceMeters(
          lat as number,
          lng as number,
          item.lostLat,
          item.lostLng
        )
      );

      if (distanceMeters <= 2000) {
        notificationTasks.push(
          notificationService.notifyMatchFound({
            receiverId: item.owner.id,
            distanceMeters,
            postId: item.id,
            itemName: item.name,
          })
        );
      }

      if (distanceMeters <= 100) {
        notificationTasks.push(
          notificationService.notifyProximityAlert({
            receiverId: item.owner.id,
            distanceMeters,
            postId: item.id,
          })
        );
      }
    }

    await Promise.allSettled(notificationTasks);

    return {
      success: true,
      chatToken,
      guestId: guestUser.id,
      channelId,
      guestInfo: {
        id: guestUser.id,
        displayName: guestDisplayName,
      },
    };
  }

  // Lấy danh sách items của user
  async listItems(
    userId: string,
    query: ListItemsQuery
  ): Promise<ListItemsResponse> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const { items, total } = await itemRepository.findByOwnerId(userId, {
      status: query.status === "ALL" ? undefined : query.status,
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
  async updateItem(
    itemId: string,
    userId: string,
    data: UpdateItemDTO
  ): Promise<ItemResponse> {
    const item = await itemRepository.findById(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.ownerId !== userId) {
      throw new AppError("You don't have permission to update this item", 403);
    }

    // Validate security PIN if provided
    if (data.securityPin && !/^\d{4}$/.test(data.securityPin)) {
      throw new AppError("Security PIN must be 4 digits", 400);
    }

    // Validate location JSON if provided
    if (data.lastSeenLocation) {
      try {
        const location = JSON.parse(data.lastSeenLocation);
        if (
          typeof location.lat !== "number" ||
          typeof location.lng !== "number"
        ) {
          throw new Error("Invalid location format");
        }
      } catch {
        throw new AppError(
          "lastSeenLocation must be valid JSON with lat and lng",
          400
        );
      }
    }

    const updated = await itemRepository.updateItem(itemId, data);

    logger.info(`Item updated: ${item.itemId} by user ${userId}`);

    return this.formatItemResponse(updated);
  }

  // Xóa item
  async deleteItem(itemId: string, userId: string): Promise<void> {
    const item = await itemRepository.findById(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.ownerId !== userId) {
      throw new AppError("You don't have permission to delete this item", 403);
    }

    await itemRepository.deleteItem(itemId);

    logger.info(`Item deleted: ${item.itemId} by user ${userId}`);
  }

  // Thay đổi trạng thái item (lost/safe)
  async updateStatus(
    itemId: string,
    userId: string,
    status: "SAFE" | "PENDING_PAYMENT" | "LOST" | "FOUND" | "RESOLVED",
    lostMessage?: string,
    coordinates: {
      latitude?: number;
      longitude?: number;
    } = {}
  ): Promise<ItemResponse> {
    const item = await itemRepository.findById(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.ownerId !== userId) {
      throw new AppError(
        "You don't have permission to update item status",
        403
      );
    }

    const updateData: UpdateItemDTO = { status };
    let reportedCoordinates: { latitude: number; longitude: number } | null =
      null;

    if (status === "LOST" && lostMessage) {
      updateData.lostMessage = lostMessage;
    }

    if (status === "LOST") {
      reportedCoordinates = this.resolveReportedCoordinates(
        coordinates,
        item.lastSeenLocation
      );

      if (!reportedCoordinates) {
        throw new AppError(
          "Location coordinates are required when reporting item as lost",
          400
        );
      }
    }

    const updated = await itemRepository.updateItem(itemId, updateData);

    if (status === "LOST" && reportedCoordinates) {
      const geohash = encodeGeoHash(
        reportedCoordinates.latitude,
        reportedCoordinates.longitude,
        ITEM_GEOHASH_PRECISION
      );

      await itemRepository.updateItemGeoPoint(
        itemId,
        reportedCoordinates.latitude,
        reportedCoordinates.longitude,
        geohash
      );

      await emitLostItemToNearbyUsers({
        id: updated.id,
        itemId: updated.itemId,
        name: updated.name,
        category: updated.category,
        description: updated.description || undefined,
        lostMessage: updated.lostMessage || undefined,
        imagePublicUrl: updated.imagePublicUrl || undefined,
        latitude: reportedCoordinates.latitude,
        longitude: reportedCoordinates.longitude,
        reportedAt: new Date().toISOString(),
      });
    }

    if (status === "SAFE") {
      await itemRepository.clearItemGeoPoint(itemId);

      // Cancel active report/escrow flow and trigger REFUNDED notification.
      await reportService.cancelEscrowForItem(userId, itemId);
    }

    logger.info(
      `Item status changed to ${status}: ${item.itemId} by user ${userId}`
    );

    return this.formatItemResponse(updated);
  }

  // Tìm kiếm items
  async searchItems(
    userId: string,
    query: SearchItemsQuery
  ): Promise<SearchItemsResponse> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    if (!query.q || query.q.trim().length === 0) {
      throw new AppError("Search query is required", 400);
    }

    const searchQuery = query.q.trim();

    const { items, total } = await itemRepository.searchItems(userId, {
      query: searchQuery,
      status: query.status || undefined,
      category: query.category || undefined,
      skip,
      take: limit,
    });

    logger.info(
      `User ${userId} searched for "${searchQuery}", found ${total} results`
    );

    return {
      items: items.map((item) => this.formatItemResponse(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      query: searchQuery,
    };
  }

  // Lấy thống kê Dashboard
  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const stats = await itemRepository.getDashboardStats(userId);

    return {
      totalItems: stats.totalItems,
      safeItems: stats.safeItems,
      lostItems: stats.lostItems,
      recentItems: stats.recentItems.map((item) =>
        this.formatItemResponse(item)
      ),
      categorySummary: stats.categoryCounts,
    };
  }

  // Lấy danh sách categories hợp lệ
  getCategories(): string[] {
    return [...ITEM_CATEGORIES];
  }
}

export const itemService = new ItemService();
