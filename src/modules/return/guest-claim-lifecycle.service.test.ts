import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionDb, itemDb, postDb, closeChannel, lastMessageAt } = vi.hoisted(
  () => ({
    sessionDb: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    itemDb: { updateMany: vi.fn() },
    postDb: { updateMany: vi.fn() },
    closeChannel: vi.fn(),
    lastMessageAt: vi.fn(),
  })
);

vi.mock("../../libs/prisma", () => ({
  prisma: {
    returnSession: sessionDb,
    item: itemDb,
    post: postDb,
    $transaction: (callback: (tx: any) => unknown) =>
      callback({ returnSession: sessionDb, item: itemDb, post: postDb }),
  },
}));
vi.mock("../../libs/stream-chat", () => ({
  closeItemChannel: closeChannel,
  getItemChannelLastMessageAt: lastMessageAt,
}));

import { guestClaimLifecycleService } from "./guest-claim-lifecycle.service";

describe("guest claim lifecycle", () => {
  const cutoff = new Date("2026-10-01T00:00:00.000Z");
  const session = {
    id: "session-1",
    channelId: "item_qr1_guest1",
    ownerId: "owner1",
    finderId: "guest1",
    itemId: "item-db-id",
    status: "CHAT_ACTIVE",
    createdAt: new Date(cutoff.getTime() - 60_000),
    updatedAt: new Date(cutoff.getTime() - 60_000),
    finder: { role: "guest" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionDb.findMany.mockResolvedValue([session]);
    sessionDb.updateMany.mockResolvedValue({ count: 1 });
    itemDb.updateMany.mockResolvedValue({ count: 1 });
    postDb.updateMany.mockResolvedValue({ count: 1 });
    closeChannel.mockResolvedValue(undefined);
  });

  it("expires an inactive claim and returns its item to LOST", async () => {
    lastMessageAt.mockResolvedValue(null);
    await expect(
      guestClaimLifecycleService.expireAbandonedGuestClaims(
        new Date(cutoff.getTime() + 49 * 60 * 60 * 1000)
      )
    ).resolves.toBe(1);
    expect(sessionDb.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: session.id, status: "CHAT_ACTIVE" },
        data: expect.objectContaining({ status: "MEETUP_CANCELLED" }),
      })
    );
    expect(itemDb.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "LOST" } })
    );
  });

  it("keeps recent Stream last_message_at claims active", async () => {
    lastMessageAt.mockResolvedValue(new Date("2026-10-02T00:00:00.000Z"));
    await expect(
      guestClaimLifecycleService.expireAbandonedGuestClaims(
        new Date(cutoff.getTime() + 49 * 60 * 60 * 1000)
      )
    ).resolves.toBe(0);
    expect(closeChannel).not.toHaveBeenCalled();
  });

  it("skips claims when Stream activity lookup fails", async () => {
    lastMessageAt.mockRejectedValue(new Error("Stream unavailable"));
    await expect(
      guestClaimLifecycleService.expireAbandonedGuestClaims(
        new Date(cutoff.getTime() + 49 * 60 * 60 * 1000)
      )
    ).resolves.toBe(0);
    expect(sessionDb.updateMany).not.toHaveBeenCalled();
  });

  it("is idempotent when the claim was already cancelled", async () => {
    sessionDb.findMany.mockResolvedValue([]);
    await guestClaimLifecycleService.expireAbandonedGuestClaims();
    await guestClaimLifecycleService.expireAbandonedGuestClaims();
    expect(sessionDb.updateMany).not.toHaveBeenCalled();
  });

  it("lets the owner reject an active guest claim and freezes its channel", async () => {
    sessionDb.findUnique.mockResolvedValue(session);
    await guestClaimLifecycleService.rejectByOwner("owner1", session.id);
    expect(closeChannel).toHaveBeenCalledWith(session.channelId);
    expect(sessionDb.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: session.id, status: "CHAT_ACTIVE" },
        data: expect.objectContaining({ status: "MEETUP_CANCELLED" }),
      })
    );
    expect(itemDb.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "LOST" } })
    );
  });
});
