import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../../libs/prisma", () => ({
  prisma: {
    $queryRaw: db.queryRaw,
    item: { count: db.count },
  },
}));

import { fetchLostFeed } from "./home.repository";
import { homeService } from "./home.service";

describe("Home Lost Feed Radar verification (Phase 2)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("filters items strictly by ItemStatus.LOST and PostGIS ST_DWithin within the radius cap", async () => {
    db.queryRaw.mockResolvedValue([
      {
        itemId: "item-lost-1",
        ownerId: "other-user",
        name: "Balo Laptop",
        category: "bag",
        imagePublicUrl: "https://example.com/bag.jpg",
        lostMessage: "Quên ở quán cafe",
        lostAddress: "Tạ Hiện, Hoàn Kiếm",
        lostLat: 21.033,
        lostLng: 105.852,
        distanceMeters: 450,
        locationUpdatedAt: new Date("2026-09-21T10:00:00.000Z"),
        updatedAt: new Date("2026-09-21T10:00:00.000Z"),
        ownerDisplayName: "Lê Văn C",
        ownerPhotoURL: null,
      },
    ]);
    db.count.mockResolvedValue(1);

    const result = await homeService.getLostFeed("my-user-id", {
      lat: 21.0285,
      lng: 105.8544,
      radius: 5000,
    });

    const statement = db.queryRaw.mock.calls[0]![0] as {
      sql: string;
      values: unknown[];
    };

    // SQL assertions: strictly ItemStatus.LOST and ST_DWithin
    expect(statement.sql).toContain('i."status" = ?');
    expect(statement.sql).toContain('i."location" IS NOT NULL');
    expect(statement.sql).toContain("ST_DWithin");
    expect(statement.sql).toContain("ST_Distance");
    expect(statement.values).toContain(5000);

    expect(result.cards).toHaveLength(1);
    expect(result.pins).toHaveLength(1);
    expect(result.nearbyCount).toBe(1);
    expect(result.myLostCount).toBe(1);
  });

  it("strictly enforces privacy: cards and pins never expose captureLatitude, captureLongitude, or captureAddress", async () => {
    db.queryRaw.mockResolvedValue([
      {
        itemId: "sensitive-item-1",
        ownerId: "owner-99",
        name: "Ví tiền bí mật",
        category: "wallet",
        imagePublicUrl: null,
        lostMessage: null,
        lostAddress: "Địa điểm công cộng",
        lostLat: 21.028,
        lostLng: 105.834,
        distanceMeters: 200,
        locationUpdatedAt: new Date("2026-09-22T00:00:00.000Z"),
        updatedAt: new Date("2026-09-22T00:00:00.000Z"),
        ownerDisplayName: "Ẩn danh",
        ownerPhotoURL: null,
      },
    ]);

    const result = await fetchLostFeed("owner-99", {
      lat: 21.028,
      lng: 105.834,
      radius: 1000,
    });

    const card = result.cards[0] as unknown as Record<string, unknown>;
    const pin = result.pins[0] as unknown as Record<string, unknown>;

    // Absolute privacy assertion: zero capture-related fields
    expect(card.captureLatitude).toBeUndefined();
    expect(card.captureLongitude).toBeUndefined();
    expect(card.captureAddress).toBeUndefined();
    expect(card.captureAccuracyMeters).toBeUndefined();
    expect(card.capturedAt).toBeUndefined();
    expect(card.captureLocation).toBeUndefined();

    expect(pin.captureLatitude).toBeUndefined();
    expect(pin.captureLongitude).toBeUndefined();
    expect(pin.captureAddress).toBeUndefined();
    expect(pin.captureLocation).toBeUndefined();

    // Coordinates are exclusively the canonical lost coordinates
    expect(card.lostLat).toBe(21.028);
    expect(card.lostLng).toBe(105.834);
    expect(pin.lat).toBe(21.028);
    expect(pin.lng).toBe(105.834);
  });

  it("caps excessive client radius at 10,000 meters in repository query", async () => {
    db.queryRaw.mockResolvedValue([]);

    await fetchLostFeed(undefined, {
      lat: 21.028,
      lng: 105.834,
      radius: 999_999, // User requested 999km
    });

    const statement = db.queryRaw.mock.calls[0]![0] as {
      sql: string;
      values: unknown[];
    };

    // The radius parameter passed to SQL must be clamped to 10,000 meters
    expect(statement.values).toContain(10_000);
    expect(statement.values).not.toContain(999_999);
  });

  describe("Optional auth ownership decoration", () => {
    const mockRawRows = [
      {
        itemId: "item-101",
        ownerId: "user-alpha",
        name: "Áo khoác",
        category: "clothing",
        imagePublicUrl: null,
        lostMessage: null,
        lostAddress: "Công viên Thống Nhất",
        lostLat: 21.015,
        lostLng: 105.842,
        distanceMeters: 300,
        locationUpdatedAt: new Date("2026-09-22T00:00:00.000Z"),
        updatedAt: new Date("2026-09-22T00:00:00.000Z"),
        ownerDisplayName: "Alpha",
        ownerPhotoURL: null,
      },
    ];

    it("guest (unauthenticated / undefined userId) receives isOwn === false without auth failure", async () => {
      db.queryRaw.mockResolvedValue(mockRawRows);
      const result = await fetchLostFeed(undefined, {
        lat: 21.015,
        lng: 105.842,
        radius: 2000,
      });

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]!.isOwn).toBe(false);
      expect(result.pins[0]!.isOwn).toBe(false);
    });

    it("authenticated owner receives isOwn === true for own item", async () => {
      db.queryRaw.mockResolvedValue(mockRawRows);
      const result = await fetchLostFeed("user-alpha", {
        lat: 21.015,
        lng: 105.842,
        radius: 2000,
      });

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]!.isOwn).toBe(true);
      expect(result.pins[0]!.isOwn).toBe(true);
    });

    it("authenticated non-owner receives isOwn === false for other user's item", async () => {
      db.queryRaw.mockResolvedValue(mockRawRows);
      const result = await fetchLostFeed("user-beta", {
        lat: 21.015,
        lng: 105.842,
        radius: 2000,
      });

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]!.isOwn).toBe(false);
      expect(result.pins[0]!.isOwn).toBe(false);
    });
  });
});
