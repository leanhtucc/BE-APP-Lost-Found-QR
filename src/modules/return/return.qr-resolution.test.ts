import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, notify } = vi.hoisted(() => ({
  db: {
    item: { findUnique: vi.fn(), findFirst: vi.fn() },
    returnSession: { findUnique: vi.fn(), create: vi.fn() },
    post: { findFirst: vi.fn() },
  },
  notify: vi.fn(),
}));
vi.mock("../../libs/prisma", () => ({ prisma: db }));
vi.mock("../../libs/redis", () => ({ redis: { del: vi.fn() } }));
vi.mock("../../libs/stream-chat", () => ({ closeItemChannel: vi.fn() }));
vi.mock("../notification/notification.service", () => ({
  notificationService: { notifyReturnEvent: notify },
}));
vi.mock("../../socket/return.socket", () => ({
  emitReturnHandoverUpdated: vi.fn(),
  emitReturnLocationCleared: vi.fn(),
  emitReturnParticipantArrived: vi.fn(),
  emitReturnRewardUpdated: vi.fn(),
  emitReturnSessionUpdated: vi.fn(),
}));
vi.mock("../../socket/radar.socket", () => ({
  emitLostItemRemovedToNearbyUsers: vi.fn(),
}));

import { ReturnService } from "./return.service";

describe("return session channel QR resolution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves channel QR to the database item while keeping the internal id", async () => {
    const service = new ReturnService();
    vi.spyOn(service as any, "formatSession").mockReturnValue({
      id: "session",
    });
    db.returnSession.findUnique.mockResolvedValue(null);
    db.item.findUnique.mockResolvedValue({
      id: "internal-db-id",
      qrCodeId: "qr-public-id",
      ownerId: "owner-id",
      owner: { id: "owner-id" },
    });
    db.post.findFirst.mockResolvedValue(null);
    db.returnSession.create.mockResolvedValue({ id: "session" });
    notify.mockResolvedValue(undefined);

    await service.createOrGetSession("owner-id", {
      channelId: "item_qr-public-id_finder-id",
    });

    expect(db.item.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { qrCodeId: "qr-public-id" } })
    );
    expect(db.item.findFirst).not.toHaveBeenCalled();
    expect(db.returnSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ itemId: "internal-db-id" }),
      })
    );
  });
});
