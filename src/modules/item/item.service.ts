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
import {
  emitLostItemRemovedToNearbyUsers,
  emitLostItemToNearbyUsers,
} from "../../socket/radar.socket";
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
  PublicItemResponse,
  ScanQRResponse,
  SearchItemsQuery,
  SearchItemsResponse,
  SelectionSummaryResponse,
  UpdateItemDTO,
} from "./item.types";

/**
 * Item Service
 * Business logic cho Item module
 */

const itemRepository = new ItemRepository();
const ITEM_GEOHASH_PRECISION = 6;

export class ItemService {
  private async emitLostRemoval(
    item: any,
    status: "SAFE" | "FOUND" | "RESOLVED" | "DELETED"
  ): Promise<void> {
    const latitude = Number(item.lostLat ?? item.latitude);
    const longitude = Number(item.lostLng ?? item.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    try {
      await emitLostItemRemovedToNearbyUsers({
        itemId: item.itemId,
        latitude,
        longitude,
        status,
        removedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Item left LOST state but radar removal failed", error);
    }
  }

  private resolveReportedCoordinates(
    coordinates: {
      latitude?: number;
      longitude?: number;
    },
    fallbackLocation?: string | null,
    itemLatitude?: number | string | null,
    itemLongitude?: number | string | null
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

    // Fallback to item known coordinates saved during item protection/creation
    const parsedItemLat = itemLatitude !== null && itemLatitude !== undefined ? Number(itemLatitude) : null;
    const parsedItemLng = itemLongitude !== null && itemLongitude !== undefined ? Number(itemLongitude) : null;
    if (
      parsedItemLat !== null &&
      parsedItemLng !== null &&
      Number.isFinite(parsedItemLat) &&
      Number.isFinite(parsedItemLng)
    ) {
      return { latitude: parsedItemLat, longitude: parsedItemLng };
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
      publicItemId: item.itemId,
      ownerId: item.ownerId,
      name: item.name,
      category: item.category,
      description: item.description,
      status: item.status,
      lostMessage: item.lostMessage,
      lostAddress: item.lostAddress,
      lostLat: item.lostLat,
      lostLng: item.lostLng,
      latitude: item.latitude,
      longitude: item.longitude,
      lastSeenLocation: item.lastSeenLocation,
      qrCodeId: item.qrCodeId,
      imagePublicUrl: item.imagePublicUrl,
      details: item.details,
      hasInsurance: item.hasInsurance,
      captureLatitude: item.captureLatitude,
      captureLongitude: item.captureLongitude,
      captureAddress: item.captureAddress,
      captureAccuracyMeters: item.captureAccuracyMeters,
      capturedAt: item.capturedAt,
      captureLocation:
        item.captureLatitude !== null && item.captureLatitude !== undefined
          ? {
              latitude: item.captureLatitude,
              longitude: item.captureLongitude,
              address: item.captureAddress,
              accuracyMeters: item.captureAccuracyMeters,
              capturedAt: item.capturedAt ? new Date(item.capturedAt).toISOString() : null,
            }
          : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  /**
   * Format items eligible for creating a Guardian report.
   */
  private formatEligibleItemResponse(item: any) {
    const details = (item.details as Record<string, unknown> | null) ?? {};
    const rawSerial = details.serial ?? details.imei;
    const serial =
      typeof rawSerial === "string" && rawSerial.length > 7
        ? `${rawSerial.slice(0, 4)}...${rawSerial.slice(-3)}`
        : rawSerial ?? null;

    return {
      id: item.id,
      item_id: item.id,
      qr_code_id: item.qrCodeId,
      name: item.name,
      category: item.category,
      image_url: item.imagePublicUrl ?? null,
      status: item.status,
      has_insurance: item.hasInsurance ?? false,
      details: {
        color: details.color ?? null,
        storage: details.storage ?? null,
        serial,
      },
    };
  }

  // Tạo item mới
  async createItem(userId: string, data: CreateItemDTO): Promise<ItemResponse> {
    try {
      if (!data.imagePublicUrl || !data.imagePublicUrl.trim()) {
        throw new AppError("Image URL is required", 400);
      }

      let captureLat: number | null = null;
      let captureLng: number | null = null;
      let captureAddress: string | null = null;
      let captureAccuracy: number | null = null;
      let capturedAtDate: Date | null = null;

      if (data.captureLocation) {
        const cLat = data.captureLocation.latitude;
        const cLng = data.captureLocation.longitude;
        if (cLat < -90 || cLat > 90) {
          throw new AppError("latitude must be in range [-90, 90]", 400);
        }
        if (cLng < -180 || cLng > 180) {
          throw new AppError("longitude must be in range [-180, 180]", 400);
        }
        captureLat = cLat;
        captureLng = cLng;
        captureAddress = data.captureLocation.address || null;
        captureAccuracy = data.captureLocation.accuracyMeters ?? null;
        capturedAtDate = data.captureLocation.capturedAt
          ? new Date(data.captureLocation.capturedAt)
          : new Date();
      } else {
        const hasLat =
          data.latitude !== undefined &&
          data.latitude !== null &&
          Number.isFinite(data.latitude);
        const hasLng =
          data.longitude !== undefined &&
          data.longitude !== null &&
          Number.isFinite(data.longitude);

        if (hasLat !== hasLng) {
          throw new AppError(
            "latitude and longitude must be provided together",
            400
          );
        }

        if (hasLat && hasLng) {
          if (data.latitude! < -90 || data.latitude! > 90) {
            throw new AppError("latitude must be in range [-90, 90]", 400);
          }
          if (data.longitude! < -180 || data.longitude! > 180) {
            throw new AppError("longitude must be in range [-180, 180]", 400);
          }
          captureLat = data.latitude!;
          captureLng = data.longitude!;
          captureAddress = data.address || data.lastSeenLocation || null;
          capturedAtDate = new Date();
        }
      }

      const lastSeenLocation = data.lastSeenLocation || data.address || null;
      const { address, captureLocation, ...cleanData } = data;

      // Generate unique IDs
      const qrCodeId = nanoid(16);
      const securityToken = nanoid(32);

      const item = await itemRepository.createItem({
        ...cleanData,
        status: "SAFE",
        latitude: null,
        longitude: null,
        lastSeenLocation,
        locationGeoHash: null,
        captureLatitude: captureLat,
        captureLongitude: captureLng,
        captureAddress: captureAddress,
        captureAccuracyMeters: captureAccuracy,
        capturedAt: capturedAtDate,
        ownerId: userId,
        qrCodeId,
        securityToken,
      });

      logger.info(`Item created: ${item.qrCodeId} (status: SAFE) by user ${userId}`);

      return this.formatItemResponse(item);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Create item error:", error);
      throw new AppError("Failed to create item", 500);
    }
  }

  // Lấy thông tin item (chỉ owner)
  async getItem(identifier: string, userId: string): Promise<ItemResponse> {
    const item = await itemRepository.findByIdentifier(identifier);

    if (!item) {
      throw new AppError("Item not found", 404, true, "ITEM_NOT_FOUND");
    }

    if (item.ownerId !== userId) {
      throw new AppError(
        "You don't have permission to view this item",
        403,
        true,
        "ITEM_FORBIDDEN"
      );
    }

    return this.formatItemResponse(item);
  }

  // Chi tiết công khai cho đồ thất lạc trên Radar / công cộng
  async getPublicItem(identifier: string): Promise<PublicItemResponse> {
    const item = await itemRepository.findByIdentifier(identifier);

    if (!item) {
      throw new AppError("Item not found", 404, true, "ITEM_NOT_FOUND");
    }

    const shortId = (item.owner?.memberId || item.owner?.uid || "LOST")
      .substring(0, 4)
      .toUpperCase();

    const ownerInfo = {
      displayName: `Chủ nhân ẩn danh #${shortId}`,
      avatar: null,
      joinedDate: item.owner?.createdAt
        ? new Date(item.owner.createdAt).getFullYear().toString()
        : "",
    };

    if (item.status !== "LOST") {
      return {
        id: item.qrCodeId,
        publicItemId: item.itemId,
        name: item.name,
        category: item.category,
        status: item.status,
        description: item.description || null,
        imagePublicUrl: item.imagePublicUrl || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        owner: ownerInfo,
        message: "This item is not reported as lost",
      };
    }

    return {
      id: item.qrCodeId,
      publicItemId: item.itemId,
      name: item.name,
      category: item.category,
      status: item.status,
      description: item.description || null,
      lostMessage: item.lostMessage || null,
      lostAddress: item.lostAddress || null,
      lostLat: item.lostLat ?? null,
      lostLng: item.lostLng ?? null,
      imagePublicUrl: item.imagePublicUrl || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      owner: ownerInfo,
    };
  }

  // Quét QR code (public endpoint)
  async scanQRCode(qrCodeId: string): Promise<ScanQRResponse> {
    const item = await itemRepository.findByQrCodeId(qrCodeId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    await itemRepository.recordQrScan(item.id);

    const shortId = (item.owner.memberId || item.owner.uid || "A3F2")
      .substring(0, 4)
      .toUpperCase();

    // Chủ nhân ẩn danh
    const ownerInfo: any = {
      display_name: `Chủ nhân ẩn danh #${shortId}`,
      avatar: "", // Khóa ảnh đại diện cho chế độ ẩn danh theo design
      joined_date: new Date(item.owner.createdAt).getFullYear().toString(),
    };

    if (item.status !== "LOST") {
      const messages: Record<string, string> = {
        SAFE: "This item is not reported as lost",
        FOUND: "The owner is already in contact with a finder",
        RESOLVED: "This lost-item case has already been resolved",
      };

      return {
        item_info: {
          id: item.qrCodeId,
          name: item.name,
          category: item.category,
          status: item.status,
          description: item.description || undefined,
          image_url: item.imagePublicUrl || undefined,
          owner_info: ownerInfo,
        },
        action: "info_only",
        message: messages[item.status] ?? "This item cannot accept a finder",
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
        id: item.qrCodeId,
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
    qrCodeId: string,
    phoneNumber: string,
    lat?: number,
    lng?: number
  ) {
    const item = await itemRepository.findByQrCodeId(qrCodeId);

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
      qrCodeId,
      item.name,
      item.owner.id,
      guestUser.id
    );

    const claimed = await prisma.$transaction(async (tx) => {
      const itemTransition = await tx.item.updateMany({
        where: { id: item.id, status: "LOST" },
        data: { status: "FOUND" },
      });

      if (itemTransition.count !== 1) return false;

      await tx.post.updateMany({
        where: { itemId: item.id, status: "ACTIVE" },
        data: { status: "FOUND" },
      });
      return true;
    });

    if (!claimed) {
      throw new AppError(
        "Another finder has already claimed this item",
        409,
        true,
        "ITEM_ALREADY_FOUND"
      );
    }

    await this.emitLostRemoval(item, "FOUND");

    // Persist notification records for app inbox + in-app realtime emit.
    const notificationTasks: Promise<unknown>[] = [
      notificationService.notifyStatusUpdate({
        receiverId: item.owner.id,
        category: "ITEM",
        type: "QR_SCANNED",
        title: "Có người quét mã QR",
        content: `${guestDisplayName} đã quét QR của món đồ ${item.name}`,
        metadata: {
          item_id: qrCodeId,
          room_id: channelId,
          finder_id: guestUser.id,
        },
      }),
      notificationService.notifyNewChat({
        receiverId: item.owner.id,
        senderAvatar: guestUser.photoURL || "",
        roomId: channelId,
        messagePreview: `${guestDisplayName} vừa bắt đầu cuộc trò chuyện về ${item.name}`,
        itemId: qrCodeId,
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

  /**
   * GET /v1/items/:id/selection-summary
   * Trả về dữ liệu đầy đủ cho box "ĂChi tiết lựa chọn" trước khi kích hoạt Radar.
   * Bao gồm: tên, mô tả AI, serial mask, badge bảo hiểm.
   */
  async getSelectionSummary(
    itemId: string,
    userId: string
  ): Promise<SelectionSummaryResponse> {
    const item = await itemRepository.findById(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.ownerId !== userId) {
      throw new AppError("You don't have permission to view this item", 403);
    }

    const attrs: Record<string, string> = (item.details as any) ?? {};

    // --- primary: Màu + Dung lượng ---
    const parts: string[] = [];
    if (attrs["color"]) parts.push(attrs["color"]);
    if (attrs["storage"]) parts.push(attrs["storage"]);
    const primary = parts.length > 0 ? parts.join(" - ") : item.name;

    // --- secondary: Mô tả AI ---
    // Ưu tiên description AI, fallback sang description thông thường, rồi mới đến tững attr
    let secondary = attrs["ai_description"] || item.description || "";
    if (!secondary && attrs["color"]) {
      // Dựng description từ các trường có sẵn
      const descParts: string[] = [];
      if (attrs["color"]) descParts.push(attrs["color"]);
      if (attrs["storage"]) descParts.push(attrs["storage"]);
      if (attrs["model"]) descParts.push(attrs["model"]);
      secondary = descParts.join(" - ");
    }

    // --- Serial masking: hiện 4 đầu + 3 cuối ---
    const rawSerial: string | undefined = attrs["serial"] || attrs["imei"];
    let maskedSerial: string | null = null;
    if (rawSerial && rawSerial.length > 7) {
      maskedSerial = `${rawSerial.substring(0, 4)}...${rawSerial.substring(rawSerial.length - 3)}`;
    } else if (rawSerial) {
      maskedSerial = rawSerial; // Quá ngắn, hiện toàn bộ
    }

    // --- ai_visual_tags: Ưu tiên từ JSONB, fallback sinh từ color + storage ---
    let aiVisualTags: string[] = [];
    if (Array.isArray(attrs["ai_visual_tags"])) {
      aiVisualTags = attrs["ai_visual_tags"] as unknown as string[];
    } else if (typeof attrs["ai_visual_tags"] === "string") {
      try {
        aiVisualTags = JSON.parse(attrs["ai_visual_tags"]);
      } catch {
        /* ignore */
      }
    }
    if (aiVisualTags.length === 0 && attrs["color"]) {
      aiVisualTags = [attrs["color"]];
      if (attrs["storage"]) aiVisualTags.push(attrs["storage"]);
    }

    // --- Insurance badge ---
    const hasInsurance = item.hasInsurance ?? false;
    const badge = hasInsurance
      ? { label: "CÓ BẢO HIỂM", color_theme: "SUCCESS" as const }
      : { label: "STANDARD PROTECTION", color_theme: "STANDARD" as const };

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      image_url: item.imagePublicUrl ?? undefined,
      display_text: {
        primary,
        secondary,
        serial_number: maskedSerial,
      },
      status_badges: {
        has_insurance: hasInsurance,
        label: badge.label,
        color_theme: badge.color_theme,
      },
      ai_visual_tags: aiVisualTags,
    };
  }

  /**
   * GET /v1/items/eligible-for-report (màn hình 1)
   * Chỉ trả item của chủ sở hữu chưa có Guardian report đang mở.
   */
  async getEligibleItemsForReport(userId: string) {
    const items = await prisma.item.findMany({
      where: {
        ownerId: userId,
        status: "SAFE",
        posts: { none: { status: { in: ["PENDING_PAYMENT", "ACTIVE"] } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return { items: items.map((item) => this.formatEligibleItemResponse(item)) };
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
    const item = await itemRepository.findByIdentifier(itemId);

    if (!item) {
      throw new AppError("Item not found", 404, true, "ITEM_NOT_FOUND");
    }

    if (item.ownerId !== userId) {
      throw new AppError(
        "You don't have permission to update this item",
        403,
        true,
        "ITEM_FORBIDDEN"
      );
    }

    const updated = await itemRepository.updateItem(item.id, data);

    logger.info(`Item updated: ${item.qrCodeId} by user ${userId}`);

    return this.formatItemResponse(updated);
  }

  // Xóa item
  async deleteItem(itemId: string, userId: string): Promise<void> {
    const item = await itemRepository.findByIdentifier(itemId);

    if (!item) {
      throw new AppError("Item not found", 404, true, "ITEM_NOT_FOUND");
    }

    if (item.ownerId !== userId) {
      throw new AppError(
        "You don't have permission to delete this item",
        403,
        true,
        "ITEM_FORBIDDEN"
      );
    }

    await itemRepository.deleteItem(item.id);

    if (item.status === "LOST") {
      await this.emitLostRemoval(item, "DELETED");
    }

    logger.info(`Item deleted: ${item.qrCodeId} by user ${userId}`);
  }

  // Thay đổi trạng thái item (lost/safe)
  async updateStatus(
    itemId: string,
    userId: string,
    status: "SAFE" | "LOST",
    lostMessage?: string,
    coordinates: {
      latitude?: number;
      longitude?: number;
      address?: string;
    } = {}
  ): Promise<ItemResponse> {
    const item = await itemRepository.findByIdentifier(itemId);

    if (!item) {
      throw new AppError("Item not found", 404, true, "ITEM_NOT_FOUND");
    }

    if (item.ownerId !== userId) {
      throw new AppError(
        "You don't have permission to update item status",
        403,
        true,
        "ITEM_FORBIDDEN"
      );
    }

    let reportedCoordinates: { latitude: number; longitude: number } | null =
      null;

    if (item.status === status) {
      if (status === "SAFE") {
        await reportService.cancelEscrowForItem(userId, item.id);
      }
      return this.formatItemResponse(item);
    }

    if (status === "LOST") {
      reportedCoordinates = this.resolveReportedCoordinates(
        coordinates,
        item.lastSeenLocation,
        item.latitude,
        item.longitude
      );

      if (!reportedCoordinates) {
        throw new AppError(
          "Location coordinates are required when reporting item as lost",
          400
        );
      }
    }

    let updated: any;
    if (status === "LOST" && reportedCoordinates) {
      const geohash = encodeGeoHash(
        reportedCoordinates.latitude,
        reportedCoordinates.longitude,
        ITEM_GEOHASH_PRECISION
      );

      updated = await itemRepository.markLost(
        item.id,
        userId,
        {
          lostMessage,
          lostAddress: coordinates.address,
          latitude: reportedCoordinates.latitude,
          longitude: reportedCoordinates.longitude,
          geohash,
        }
      );

      if (!updated) {
        throw new AppError(
          "Only a SAFE item can be reported as lost",
          409,
          true,
          "ITEM_NOT_ELIGIBLE"
        );
      }

      try {
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
          reportedAt: new Date(updated.locationUpdatedAt ?? updated.updatedAt).toISOString(),
        });
      } catch (error) {
        logger.error("Item marked LOST but radar broadcast failed", error);
      }
    }

    if (status === "SAFE") {
      updated = await itemRepository.markSafe(item.id, userId);

      if (!updated) {
        throw new AppError(
          "Item cannot be moved to SAFE from its current status",
          409,
          true,
          "INVALID_ITEM_STATUS_TRANSITION"
        );
      }

      if (item.status === "LOST") {
        await this.emitLostRemoval(item, "SAFE");
      }
    }

    logger.info(
      `Item status changed to ${status}: ${item.qrCodeId} by user ${userId}`
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
