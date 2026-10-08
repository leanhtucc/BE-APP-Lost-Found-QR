import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, stream, notifications } = vi.hoisted(() => ({
  db: {
    item: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { findFirst: vi.fn() },
    post: { updateMany: vi.fn() },
    returnSession: { create: vi.fn(), deleteMany: vi.fn() },
    txUser: { create: vi.fn(), deleteMany: vi.fn() },
  },
  stream: {
    createItemChannel: vi.fn(),
    createStreamUserToken: vi.fn(),
    deleteItemChannel: vi.fn(),
    deleteStreamUser: vi.fn(),
    upsertStreamUser: vi.fn(),
  },
  notifications: {
    notifyStatusUpdate: vi.fn(),
    notifyNewChat: vi.fn(),
    notifyMatchFound: vi.fn(),
    notifyProximityAlert: vi.fn(),
  },
}));

vi.mock("../../libs/prisma", () => ({
  prisma: {
    ...db,
    $transaction: (callback: (tx: any) => unknown) =>
      callback({
        item: db.item,
        post: db.post,
        user: db.txUser,
        returnSession: db.returnSession,
      }),
  },
}));
vi.mock("../../libs/stream-chat", () => stream);
vi.mock("../../libs/guest-jwt", () => ({
  issueGuestToken: () => ({ token: "guest-token", expiresAt: new Date() }),
}));
vi.mock("../notification/notification.service", () => ({
  notificationService: notifications,
}));
vi.mock("../../socket/radar.socket", () => ({
  emitLostItemRemovedToNearbyUsers: vi.fn(),
  emitLostItemToNearbyUsers: vi.fn(),
}));
vi.mock("../report/report.service", () => ({
  reportService: { cancelEscrowForItem: vi.fn() },
}));

import { ItemService } from "./item.service";

describe("guest claim identity and lookup", () => {
  const service = new ItemService();
  const lostItem = {
    id: "internal-item-id",
    itemId: "public-item-id",
    qrCodeId: "printed-qr-id",
    status: "LOST",
    name: "Wallet",
    ownerId: "owner-id",
    owner: { id: "owner-id", displayName: "Owner" },
    posts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.item.findUnique.mockResolvedValue(lostItem);
    db.item.updateMany.mockResolvedValue({ count: 1 });
    db.txUser.create.mockResolvedValue({
      id: "new-guest-id",
      displayName: "Finder",
      photoURL: null,
    });
    db.returnSession.create.mockResolvedValue({
      id: "session-id",
      channelId: "item_printed-qr-id_new-guest-id",
    });
    stream.upsertStreamUser.mockResolvedValue(undefined);
    stream.createItemChannel.mockResolvedValue(undefined);
  });

  it("resolves public guest-init only by qrCodeId and creates a distinct guest even for a registered phone", async () => {
    await service.initGuestChat("printed-qr-id", "0901234567");
    expect(db.item.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { qrCodeId: "printed-qr-id" } })
    );
    expect(db.user.findFirst).not.toHaveBeenCalled();
    expect(db.txUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "guest",
          phoneNumber: "0901234567",
        }),
      })
    );
    expect(db.returnSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: "owner-id",
          finderId: "new-guest-id",
        }),
      })
    );
  });

  it("does not resolve the internal Item.id as a public QR lookup", async () => {
    db.item.findUnique.mockResolvedValue(null);
    await expect(
      service.initGuestChat("internal-item-id", "0901234567")
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(db.item.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { qrCodeId: "internal-item-id" } })
    );
    expect(db.txUser.create).not.toHaveBeenCalled();
    expect(stream.createItemChannel).not.toHaveBeenCalled();
  });

  it("leaves no session or Stream channel when the atomic LOST claim fails", async () => {
    db.item.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.initGuestChat("printed-qr-id", "0901234567")
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.returnSession.create).not.toHaveBeenCalled();
    expect(stream.createItemChannel).not.toHaveBeenCalled();
  });

  it("allows exactly one of two concurrent claim attempts", async () => {
    db.item.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const attempts = await Promise.allSettled([
      service.initGuestChat("printed-qr-id", "0901234567"),
      service.initGuestChat("printed-qr-id", "0901234567"),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected")
    ).toHaveLength(1);
    expect(stream.createItemChannel).toHaveBeenCalledTimes(1);
  });

  it("compensates a Stream channel failure and restores LOST state", async () => {
    stream.createItemChannel.mockRejectedValueOnce(
      new Error("Stream unavailable")
    );
    await expect(
      service.initGuestChat("printed-qr-id", "0901234567")
    ).rejects.toThrow("Stream unavailable");
    expect(db.returnSession.deleteMany).toHaveBeenCalledWith({
      where: { id: "session-id" },
    });
    expect(db.item.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "internal-item-id", status: "FOUND" },
        data: { status: "LOST" },
      })
    );
    expect(db.txUser.deleteMany).toHaveBeenCalledWith({
      where: { id: "new-guest-id" },
    });
  });
});
