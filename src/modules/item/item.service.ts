import { nanoid } from "nanoid";
import { ENV } from "../../config/env";
import { logger } from "../../libs/logger";
import { AppError } from "../../middlewares/error.middleware";
import { emitLostItemToNearbyUsers } from "../../socket/radar.socket";
import { encodeGeoHash } from "../../utils/geospatial";
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

    // Lấy thông tin bounty từ Post
    let bountyAmount: number | undefined = undefined;
    let escrowStatus: string | undefined = undefined;
    // item.posts đã được include take: 1 từ Repo
    const activePost = (item as any).posts?.[0];
    if (activePost) {
      bountyAmount = activePost.bountyAmount;
      escrowStatus = "Đã khóa an toàn trong escrow";
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
        bounty_amount: bountyAmount,
        escrow_status: escrowStatus,
      },
      action: "open_chat",
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
    status: "safe" | "lost",
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

    if (status === "lost" && lostMessage) {
      updateData.lostMessage = lostMessage;
    }

    if (status === "lost") {
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

    if (status === "lost" && reportedCoordinates) {
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

    if (status === "safe") {
      await itemRepository.clearItemGeoPoint(itemId);
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
