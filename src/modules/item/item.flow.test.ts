import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const itemDb = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}));

const postDb = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

const paymentDb = vi.hoisted(() => ({
  updateMany: vi.fn(),
}));

const escrowDb = vi.hoisted(() => ({
  updateMany: vi.fn(),
}));

const qrScanDb = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("../../libs/prisma", () => ({
  prisma: {
    item: itemDb,
    post: postDb,
    payment: paymentDb,
    escrowTransaction: escrowDb,
    qrScan: qrScanDb,
    $transaction: async (cb: any) =>
      cb({
        item: itemDb,
        post: postDb,
        payment: paymentDb,
        escrowTransaction: escrowDb,
        $executeRaw: vi.fn(),
      }),
  },
}));

vi.mock("../../middlewares/auth.middleware", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (authHeader === "Bearer other-user-token") {
      req.user = { id: "user-other" };
    } else {
      req.user = { id: "user-owner" };
    }
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../socket/radar.socket", () => ({
  emitLostItemToNearbyUsers: vi.fn(),
  emitLostItemRemovedToNearbyUsers: vi.fn(),
}));

vi.mock("../report/report.service", () => ({
  reportService: {
    cancelEscrowForItem: vi.fn(),
  },
}));

import router from "./item.routes";
import { errorHandler } from "../../middlewares/error.middleware";

const app = express();
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);

describe("Item Flow and Multi-ID Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOwner = {
    id: "user-owner",
    uid: "owner_uid_123",
    displayName: "Le Anh Tu",
    email: "owner@test.com",
    photoURL: "https://example.com/avatar.jpg",
    phoneNumber: "0901234567",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    memberId: "AT01",
  };

  const sampleDbItem = {
    id: "cuid_pk_item_123",
    itemId: "cuid_public_456",
    qrCodeId: "qr_nano_789",
    securityToken: "sec_token_abc",
    ownerId: "user-owner",
    name: "Ví da màu đen",
    category: "wallet",
    description: "Có logo màu bạc",
    status: "SAFE",
    lostMessage: null,
    lostAddress: null,
    lostLat: null,
    lostLng: null,
    latitude: null,
    longitude: null,
    lastSeenLocation: "Quận 1, TP.HCM",
    imagePublicUrl: "https://storage.example.com/item.jpg",
    details: null,
    hasInsurance: false,
    captureLatitude: 10.7769,
    captureLongitude: 106.7009,
    captureAddress: "Quận 1, TP.HCM",
    captureAccuracyMeters: 12,
    capturedAt: new Date("2026-09-09T14:30:00.000Z"),
    createdAt: new Date("2026-09-09T14:30:00.000Z"),
    updatedAt: new Date("2026-09-09T14:30:00.000Z"),
    owner: mockOwner,
    posts: [],
  };

  it("1. Tạo item có ảnh và GPS trả 201, trạng thái luôn luôn là SAFE", async () => {
    itemDb.create.mockResolvedValueOnce(sampleDbItem);

    const payload = {
      name: "Ví da màu đen",
      category: "wallet",
      description: "Có logo màu bạc",
      imagePublicUrl: "https://storage.example.com/item.jpg",
      captureLocation: {
        latitude: 10.7769,
        longitude: 106.7009,
        address: "Quận 1, TP.HCM",
        accuracyMeters: 12,
        capturedAt: "2026-09-09T14:30:00.000Z",
      },
    };

    const res = await request(app)
      .post("/api/items")
      .set("Authorization", "Bearer owner-token")
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("SAFE");
    expect(res.body.data.publicItemId).toBe("cuid_public_456");
    expect(res.body.data.qrCodeId).toBe("qr_nano_789");
    expect(res.body.data.captureLocation.latitude).toBe(10.7769);
    expect(res.body.data.captureLocation.longitude).toBe(106.7009);

    expect(itemDb.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Ví da màu đen",
          category: "wallet",
          status: "SAFE",
          imagePublicUrl: "https://storage.example.com/item.jpg",
          captureLatitude: 10.7769,
          captureLongitude: 106.7009,
          captureAddress: "Quận 1, TP.HCM",
          captureAccuracyMeters: 12,
        }),
      })
    );
  });

  it("2. Thiếu ảnh hoặc chỉ gửi một trong hai tọa độ trả 400", async () => {
    // Missing imagePublicUrl
    const resNoImage = await request(app)
      .post("/api/items")
      .set("Authorization", "Bearer owner-token")
      .send({
        name: "Ví da",
        category: "wallet",
        latitude: 10.7769,
        longitude: 106.7009,
      });
    expect(resNoImage.status).toBe(400);

    // Only latitude without longitude
    const resOnlyLat = await request(app)
      .post("/api/items")
      .set("Authorization", "Bearer owner-token")
      .send({
        name: "Ví da",
        category: "wallet",
        imagePublicUrl: "https://storage.example.com/item.jpg",
        latitude: 10.7769,
      });
    expect(resOnlyLat.status).toBe(400);
  });

  it("3. Owner lấy chi tiết bằng ID nội bộ (id) thành công", async () => {
    itemDb.findFirst.mockResolvedValueOnce(sampleDbItem);

    const res = await request(app)
      .get("/api/items/cuid_pk_item_123")
      .set("Authorization", "Bearer owner-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("cuid_pk_item_123");
    expect(res.body.data.itemId).toBe("cuid_public_456");
    expect(res.body.data.publicItemId).toBe("cuid_public_456");
    expect(res.body.data.qrCodeId).toBe("qr_nano_789");
    expect(res.body.data.captureLatitude).toBe(10.7769);
    expect(res.body.data.captureLongitude).toBe(106.7009);
  });

  it("4. Kiểm tra tương thích: GET /api/items/:identifier tìm được theo cả itemId và qrCodeId", async () => {
    itemDb.findFirst.mockResolvedValueOnce(sampleDbItem);

    // Gọi bằng itemId
    const resByItemId = await request(app)
      .get("/api/items/cuid_public_456")
      .set("Authorization", "Bearer owner-token");

    expect(resByItemId.status).toBe(200);
    expect(resByItemId.body.data.id).toBe("cuid_pk_item_123");
    expect(itemDb.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { id: "cuid_public_456" },
            { itemId: "cuid_public_456" },
            { qrCodeId: "cuid_public_456" },
          ],
        },
      })
    );

    // Gọi bằng qrCodeId
    itemDb.findFirst.mockResolvedValueOnce(sampleDbItem);
    const resByQr = await request(app)
      .get("/api/items/qr_nano_789")
      .set("Authorization", "Bearer owner-token");

    expect(resByQr.status).toBe(200);
    expect(resByQr.body.data.id).toBe("cuid_pk_item_123");
  });

  it("5. Non-owner không đọc được chi tiết: trả về 403 ITEM_FORBIDDEN", async () => {
    itemDb.findFirst.mockResolvedValueOnce(sampleDbItem);

    const res = await request(app)
      .get("/api/items/cuid_pk_item_123")
      .set("Authorization", "Bearer other-user-token");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ITEM_FORBIDDEN");
  });

  it("6. Identifier không tồn tại trả về 404 ITEM_NOT_FOUND", async () => {
    itemDb.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/api/items/non_existing_id")
      .set("Authorization", "Bearer owner-token");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ITEM_NOT_FOUND");
  });

  it("7. Public API: GET /api/items/public/:id cho đồ LOST trả thông tin công khai và không lộ vị trí cất giữ bí mật", async () => {
    const lostDbItem = {
      ...sampleDbItem,
      status: "LOST",
      lostMessage: "Đánh rơi ở quán cà phê",
      lostAddress: "123 Lê Lợi, Q1",
      lostLat: 10.7761,
      lostLng: 106.7001,
    };

    itemDb.findFirst.mockResolvedValueOnce(lostDbItem);

    const res = await request(app).get("/api/items/public/cuid_public_456");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Ví da màu đen");
    expect(res.body.data.lostMessage).toBe("Đánh rơi ở quán cà phê");
    expect(res.body.data.lostAddress).toBe("123 Lê Lợi, Q1");
    // Không chứa vị trí cất giữ SAFE
    expect(res.body.data.captureLatitude).toBeUndefined();
    expect(res.body.data.captureLongitude).toBeUndefined();
    expect(res.body.data.captureAddress).toBeUndefined();
  });

  it("8. QR code quét bằng qrCodeId thành công", async () => {
    itemDb.findUnique.mockResolvedValueOnce({
      ...sampleDbItem,
      status: "SAFE",
      posts: [],
    });
    qrScanDb.create.mockResolvedValueOnce({});

    const res = await request(app).get("/api/scan/qr_nano_789");

    expect(res.status).toBe(200);
    expect(res.body.data.item_info.id).toBe("qr_nano_789");
    expect(res.body.data.action).toBe("info_only");
    expect(res.body.data.message).toBe("This item is not reported as lost");
  });

  it("9. Vị trí đăng ký không bị mất sau chu trình SAFE -> LOST -> SAFE", async () => {
    // 1. Initially SAFE with capture location
    expect(sampleDbItem.captureLatitude).toBe(10.7769);
    expect(sampleDbItem.captureLongitude).toBe(106.7009);

    // 2. Mark LOST
    itemDb.findFirst.mockResolvedValueOnce(sampleDbItem);
    itemDb.updateMany.mockResolvedValueOnce({ count: 1 });
    const lostItem = {
      ...sampleDbItem,
      status: "LOST",
      lostLat: 10.78,
      lostLng: 106.71,
      lostAddress: "Công viên 23/9",
      latitude: 10.78,
      longitude: 106.71,
    };
    itemDb.findUnique.mockResolvedValueOnce(lostItem);

    const lostRes = await request(app)
      .patch("/api/items/cuid_pk_item_123/status")
      .set("Authorization", "Bearer owner-token")
      .send({
        status: "LOST",
        latitude: 10.78,
        longitude: 106.71,
        lostAddress: "Công viên 23/9",
      });

    expect(lostRes.status).toBe(200);
    expect(lostRes.body.data.status).toBe("LOST");
    expect(lostRes.body.data.captureLatitude).toBe(10.7769);

    // 3. Mark SAFE again
    itemDb.findFirst.mockResolvedValueOnce(lostItem);
    itemDb.updateMany.mockResolvedValueOnce({ count: 1 });
    postDb.findFirst.mockResolvedValueOnce(null);
    const safeAgainItem = {
      ...sampleDbItem,
      status: "SAFE",
      lostLat: null,
      lostLng: null,
      lostAddress: null,
      latitude: null,
      longitude: null,
      captureLatitude: 10.7769, // Still preserved!
      captureLongitude: 106.7009,
    };
    itemDb.findUnique.mockResolvedValueOnce(safeAgainItem);

    const safeRes = await request(app)
      .patch("/api/items/cuid_pk_item_123/status")
      .set("Authorization", "Bearer owner-token")
      .send({
        status: "SAFE",
      });

    expect(safeRes.status).toBe(200);
    expect(safeRes.body.data.status).toBe("SAFE");
    expect(safeRes.body.data.lostLat).toBeNull();
    expect(safeRes.body.data.captureLatitude).toBe(10.7769);
    expect(safeRes.body.data.captureLongitude).toBe(106.7009);
  });

  it("10. PATCH /api/items/:id: Bỏ qua captureLocation thì bảo toàn vị trí đăng ký hiện tại", async () => {
    itemDb.findFirst.mockResolvedValueOnce(sampleDbItem);
    const updatedDbItem = {
      ...sampleDbItem,
      name: "Ví da màu đen đổi tên",
    };
    itemDb.update.mockResolvedValueOnce(updatedDbItem);

    const res = await request(app)
      .patch("/api/items/cuid_pk_item_123")
      .set("Authorization", "Bearer owner-token")
      .send({
        name: "Ví da màu đen đổi tên",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Ví da màu đen đổi tên");
    // captureLatitude/captureLongitude được giữ nguyên
    expect(res.body.data.captureLatitude).toBe(10.7769);
    expect(res.body.data.captureLongitude).toBe(106.7009);
    expect(itemDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cuid_pk_item_123" },
        data: expect.not.objectContaining({
          captureLatitude: null,
        }),
      })
    );
  });

  it("11. PATCH /api/items/:id: Cập nhật captureLocation với tọa độ hợp lệ (bao gồm cả (0, 0))", async () => {
    itemDb.findFirst.mockResolvedValueOnce(sampleDbItem);
    const updatedZeroItem = {
      ...sampleDbItem,
      captureLatitude: 0,
      captureLongitude: 0,
      captureAddress: "Vĩ độ 0, Kinh độ 0",
      captureAccuracyMeters: 3,
    };
    itemDb.update.mockResolvedValueOnce(updatedZeroItem);

    const res = await request(app)
      .patch("/api/items/cuid_pk_item_123")
      .set("Authorization", "Bearer owner-token")
      .send({
        captureLocation: {
          latitude: 0,
          longitude: 0,
          address: "Vĩ độ 0, Kinh độ 0",
          accuracyMeters: 3,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.captureLatitude).toBe(0);
    expect(res.body.data.captureLongitude).toBe(0);
    expect(itemDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cuid_pk_item_123" },
        data: expect.objectContaining({
          captureLatitude: 0,
          captureLongitude: 0,
        }),
      })
    );
  });

  it("12. PATCH /api/items/:id: captureLocation: null xóa vị trí an toàn đã lưu", async () => {
    itemDb.findFirst.mockResolvedValueOnce(sampleDbItem);
    const clearedItem = {
      ...sampleDbItem,
      captureLatitude: null,
      captureLongitude: null,
      captureAddress: null,
      captureAccuracyMeters: null,
      capturedAt: null,
    };
    itemDb.update.mockResolvedValueOnce(clearedItem);

    const res = await request(app)
      .patch("/api/items/cuid_pk_item_123")
      .set("Authorization", "Bearer owner-token")
      .send({
        captureLocation: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.captureLatitude).toBeNull();
    expect(res.body.data.captureLongitude).toBeNull();
    expect(res.body.data.captureLocation).toBeNull();
    expect(itemDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cuid_pk_item_123" },
        data: expect.objectContaining({
          captureLatitude: null,
          captureLongitude: null,
          captureAddress: null,
        }),
      })
    );
  });
});
