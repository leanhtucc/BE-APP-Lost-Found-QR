import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findSession: vi.fn(),
  findUser: vi.fn(),
  getMessageChannelId: vi.fn(),
  mute: vi.fn(),
  unmute: vi.fn(),
  ban: vi.fn(),
  unban: vi.fn(),
  flag: vi.fn(),
  unflag: vi.fn(),
  flagged: vi.fn(),
  createToken: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../../libs/prisma", () => ({
  prisma: {
    returnSession: { findUnique: m.findSession },
    user: { findUnique: m.findUser },
  },
}));
vi.mock("../../libs/stream-chat", () => ({
  banUserFromChannel: m.ban,
  closeItemChannel: vi.fn(),
  createStreamUserToken: m.createToken,
  flagMessage: m.flag,
  getFlaggedMessages: m.flagged,
  getMessageChannelId: m.getMessageChannelId,
  getUserChannels: vi.fn(),
  getUserNotifications: vi.fn(),
  logActivity: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  muteUserInChannel: m.mute,
  unbanUserFromChannel: m.unban,
  unflagMessage: m.unflag,
  unmuteUserInChannel: m.unmute,
  upsertStreamUser: m.upsert,
}));
vi.mock("../report/report.service", () => ({
  reportService: { completeEscrowFromChannel: vi.fn() },
}));
vi.mock("./stream.service", () => ({ createLostItemReturnChannel: vi.fn() }));

import { StreamChatController } from "./stream.controller";

const controller = new StreamChatController();
const SESSION = { ownerId: "owner", finderId: "finder" };

async function call(
  handler: (req: any, res: any, next: any) => Promise<void>,
  actorId: string,
  params: Record<string, string>,
  extra: Record<string, unknown> = {}
) {
  const req: any = {
    user: { id: actorId, email: `${actorId}@x.test` },
    params,
    query: {},
    body: {},
    ...extra,
  };
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  await handler(req, res, next);
  return { res, next, code: next.mock.calls[0]?.[0]?.statusCode as number };
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.findSession.mockResolvedValue(SESSION);
  m.findUser.mockResolvedValue({ role: "user" });
});

describe("mute / unmute authorization", () => {
  const params = { channelId: "c1", targetUserId: "finder" };

  it("blocks users who are not part of the return", async () => {
    const r = await call(controller.muteUser, "outsider", params);
    expect(r.code).toBe(403);
    expect(m.mute).not.toHaveBeenCalled();
  });

  it("blocks muting yourself or someone outside the return", async () => {
    expect(
      (
        await call(controller.muteUser, "owner", {
          ...params,
          targetUserId: "owner",
        })
      ).code
    ).toBe(403);
    expect(
      (
        await call(controller.muteUser, "owner", {
          ...params,
          targetUserId: "stranger",
        })
      ).code
    ).toBe(403);
    expect(m.mute).not.toHaveBeenCalled();
  });

  it("lets a participant mute the other participant", async () => {
    m.mute.mockResolvedValue({ success: true });
    const r = await call(controller.muteUser, "owner", params);
    expect(r.next).not.toHaveBeenCalled();
    expect(m.mute).toHaveBeenCalledWith("messaging", "c1", "finder", undefined);
  });

  it("applies the same rules to unmute", async () => {
    expect((await call(controller.unmuteUser, "outsider", params)).code).toBe(
      403
    );
    m.unmute.mockResolvedValue({ success: true });
    expect(
      (await call(controller.unmuteUser, "owner", params)).next
    ).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown channel", async () => {
    m.findSession.mockResolvedValue(null);
    expect((await call(controller.muteUser, "owner", params)).code).toBe(404);
  });
});

describe("ban / unban are moderator-only", () => {
  const params = { channelId: "c1", targetUserId: "finder" };

  it("rejects ordinary users, even channel participants", async () => {
    expect((await call(controller.banUser, "owner", params)).code).toBe(403);
    expect((await call(controller.unbanUser, "owner", params)).code).toBe(403);
    expect(m.ban).not.toHaveBeenCalled();
    expect(m.unban).not.toHaveBeenCalled();
  });

  it.each(["admin", "moderator"])("allows a %s", async (role) => {
    m.findUser.mockResolvedValue({ role });
    m.ban.mockResolvedValue({ success: true });
    m.unban.mockResolvedValue({ success: true });
    expect(
      (await call(controller.banUser, "mod", params)).next
    ).not.toHaveBeenCalled();
    expect(
      (await call(controller.unbanUser, "mod", params)).next
    ).not.toHaveBeenCalled();
  });

  it("rejects a caller whose account no longer exists", async () => {
    m.findUser.mockResolvedValue(null);
    expect((await call(controller.banUser, "ghost", params)).code).toBe(403);
  });
});

describe("flag / unflag require membership of the message's channel", () => {
  it("blocks users outside the channel", async () => {
    m.getMessageChannelId.mockResolvedValue("c1");
    expect(
      (
        await call(controller.flagMessageEndpoint, "outsider", {
          messageId: "m1",
        })
      ).code
    ).toBe(403);
    expect(
      (
        await call(controller.unflagMessageEndpoint, "outsider", {
          messageId: "m1",
        })
      ).code
    ).toBe(403);
    expect(m.flag).not.toHaveBeenCalled();
    expect(m.unflag).not.toHaveBeenCalled();
  });

  it("returns 404 when the message cannot be resolved", async () => {
    m.getMessageChannelId.mockResolvedValue(null);
    expect(
      (
        await call(controller.flagMessageEndpoint, "owner", {
          messageId: "nope",
        })
      ).code
    ).toBe(404);
  });

  it("lets a participant flag a message", async () => {
    m.getMessageChannelId.mockResolvedValue("c1");
    m.flag.mockResolvedValue({ success: true });
    const r = await call(controller.flagMessageEndpoint, "finder", {
      messageId: "m1",
    });
    expect(r.next).not.toHaveBeenCalled();
    expect(m.flag).toHaveBeenCalledWith("m1", "finder");
  });
});

describe("flagged message list", () => {
  it("is limited to participants and moderators", async () => {
    expect(
      (
        await call(controller.getFlaggedMessages, "outsider", {
          channelId: "c1",
        })
      ).code
    ).toBe(403);
    expect(m.flagged).not.toHaveBeenCalled();

    m.flagged.mockResolvedValue([]);
    expect(
      (await call(controller.getFlaggedMessages, "owner", { channelId: "c1" }))
        .next
    ).not.toHaveBeenCalled();

    m.findUser.mockResolvedValue({ role: "moderator" });
    expect(
      (await call(controller.getFlaggedMessages, "mod", { channelId: "c1" }))
        .next
    ).not.toHaveBeenCalled();
  });
});

describe("GET /stream/token", () => {
  it("issues a token that expires and reports when", async () => {
    m.upsert.mockResolvedValue(undefined);
    m.createToken.mockReturnValue("signed-token");
    const before = Math.floor(Date.now() / 1000);

    const { res, next } = await call(controller.getToken, "owner", {});

    expect(next).not.toHaveBeenCalled();
    const expiresAt = m.createToken.mock.calls[0]?.[1] as number;
    expect(m.createToken.mock.calls[0]?.[0]).toBe("owner");
    expect(expiresAt).toBeGreaterThan(before);
    expect(expiresAt).toBeLessThanOrEqual(before + 86400 + 5);
    const payload = res.json.mock.calls[0]?.[0]?.data;
    expect(payload).toMatchObject({
      token: "signed-token",
      userId: "owner",
      expiresAt,
    });
  });
});
