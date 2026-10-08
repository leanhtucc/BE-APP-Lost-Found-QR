import { describe, expect, it, vi } from "vitest";

const { findSession, settle, close } = vi.hoisted(() => ({
  findSession: vi.fn(),
  settle: vi.fn(),
  close: vi.fn(),
}));
vi.mock("../../libs/prisma", () => ({
  prisma: { returnSession: { findUnique: findSession } },
}));
vi.mock("../../libs/stream-chat", () => ({
  closeItemChannel: close,
  banUserFromChannel: vi.fn(),
  createStreamUserToken: vi.fn(),
  flagMessage: vi.fn(),
  getFlaggedMessages: vi.fn(),
  getUserChannels: vi.fn(),
  getUserNotifications: vi.fn(),
  logActivity: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  muteUserInChannel: vi.fn(),
  unbanUserFromChannel: vi.fn(),
  unflagMessage: vi.fn(),
  unmuteUserInChannel: vi.fn(),
  upsertStreamUser: vi.fn(),
}));
vi.mock("../report/report.service", () => ({
  reportService: { completeEscrowFromChannel: settle },
}));
vi.mock("./stream.service", () => ({ createLostItemReturnChannel: vi.fn() }));

import { StreamChatController } from "./stream.controller";

describe("close Stream channel authorization", () => {
  const controller = new StreamChatController();

  async function invoke(actor: { id: string; guest?: boolean }) {
    const req: any = {
      user: actor.guest ? undefined : { id: actor.id },
      guest: actor.guest ? { id: actor.id } : undefined,
      params: { channelId: "channel-1" },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    await controller.closeChannel(req, res, next);
    return { req, res, next };
  }

  it("returns 404 for an unknown channel and 403 for a non-participant", async () => {
    findSession.mockResolvedValueOnce(null);
    expect(
      (await invoke({ id: "owner" })).next.mock.calls[0]?.[0]?.statusCode
    ).toBe(404);
    findSession.mockResolvedValueOnce({ ownerId: "owner", finderId: "finder" });
    expect(
      (await invoke({ id: "outsider" })).next.mock.calls[0]?.[0]?.statusCode
    ).toBe(403);
    expect(close).not.toHaveBeenCalled();
  });

  it.each([
    { id: "owner", guest: false },
    { id: "finder", guest: false },
    { id: "guest", guest: true },
  ])("allows participant $id", async (actor) => {
    findSession.mockResolvedValue({
      ownerId: "owner",
      finderId: actor.id === "owner" ? "guest" : actor.id,
    });
    settle.mockResolvedValue(null);
    close.mockResolvedValue(undefined);
    const { res, next } = await invoke(actor);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(close).toHaveBeenCalledWith("channel-1");
  });
});
