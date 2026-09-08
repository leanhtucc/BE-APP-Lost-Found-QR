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

import { countOwnLostItems, fetchLostFeed } from "./home.repository";

describe("Home lost-feed repository mapping", () => {
  beforeEach(() => vi.resetAllMocks());

  it("builds cards and pins from the exact same PostGIS rows", async () => {
    db.queryRaw.mockResolvedValue([
      {
        itemId: "public-item-id",
        ownerId: "owner-id",
        name: "Ví da",
        category: "wallet",
        imagePublicUrl: null,
        lostMessage: "Đánh rơi gần hồ",
        lostAddress: "Hồ Gươm",
        lostLat: 21.031,
        lostLng: 105.837,
        distanceMeters: 823.4,
        locationUpdatedAt: new Date("2026-09-08T10:30:00.000Z"),
        updatedAt: new Date("2026-09-08T11:30:00.000Z"),
        ownerDisplayName: "Nguyễn Văn A",
        ownerPhotoURL: null,
      },
    ]);

    const result = await fetchLostFeed("owner-id", {
      lat: 21.0278,
      lng: 105.8342,
      radius: 500_000,
    });

    const statement = db.queryRaw.mock.calls[0]![0] as {
      sql: string;
      values: unknown[];
    };
    expect(statement.sql).toContain('i."status" = ?');
    expect(statement.sql).toContain('i."location" IS NOT NULL');
    expect(statement.sql).toContain("ST_DWithin");
    expect(statement.sql).toContain("ST_Distance");
    expect(statement.sql).not.toContain('i."ownerId" <>');
    expect(statement.values).toContain(10_000);

    expect(result.cards).toHaveLength(1);
    expect(result.pins).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      itemId: "public-item-id",
      isOwn: true,
      distanceMeters: 823,
      distanceLabel: "823m",
      reportedAt: "2026-09-08T10:30:00.000Z",
    });
    expect(result.pins[0]).toEqual({
      itemId: "public-item-id",
      lat: 21.031,
      lng: 105.837,
      isOwn: true,
    });
  });

  it("counts all LOST items owned by the authenticated user", async () => {
    db.count.mockResolvedValue(4);
    await expect(countOwnLostItems("owner-id")).resolves.toBe(4);
    expect(db.count).toHaveBeenCalledWith({
      where: { ownerId: "owner-id", status: "LOST" },
    });
  });
});
