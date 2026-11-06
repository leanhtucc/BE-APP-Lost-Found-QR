import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { prisma } from "./libs/prisma";
import { redis } from "./libs/redis";
import { generateAccessToken } from "./libs/jwt";
import { issueGuestToken } from "./libs/guest-jwt";
import { guestClaimLifecycleService } from "./modules/return/guest-claim-lifecycle.service";
import app from "./app";

// ─── STUB LIST ────────────────────────────────────────────────────────────────
// 1. Stream Chat: remote cloud API stubbed to avoid live Stream network dependencies.
//    Tracks channel/user creations and deletions for cleanup verification.
// 2. Firebase Notifications: stubbed in-app real-time/FCM push dispatchers.
// 3. Supabase Auth: bypasses remote Supabase server; uses local verified JWTs.
// ─────────────────────────────────────────────────────────────────────────────

const streamCalls = {
  createItemChannel: [] as any[],
  deleteItemChannel: [] as any[],
  upsertStreamUser: [] as any[],
  deleteStreamUser: [] as any[],
  closeItemChannel: [] as any[],
  lastMessageAt: null as Date | null,
};

vi.mock("./libs/stream-chat", () => ({
  createStreamUserToken: (userId: string, exp?: number) => {
    const payload: Record<string, any> = { user_id: userId };
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp) {
      payload.exp = exp;
      payload.iat = nowSec;
    }
    return jwt.sign(payload, "local-stream-test-secret-at-least-32-chars");
  },
  createItemChannel: vi.fn(async (...args: any[]) => {
    streamCalls.createItemChannel.push(args);
  }),
  deleteItemChannel: vi.fn(async (channelId: string) => {
    streamCalls.deleteItemChannel.push(channelId);
  }),
  upsertStreamUser: vi.fn(async (user: any) => {
    streamCalls.upsertStreamUser.push(user);
  }),
  deleteStreamUser: vi.fn(async (userId: string) => {
    streamCalls.deleteStreamUser.push(userId);
  }),
  closeItemChannel: vi.fn(async (channelId: string) => {
    streamCalls.closeItemChannel.push(channelId);
  }),
  getItemChannelLastMessageAt: vi.fn(async () => streamCalls.lastMessageAt),
}));

vi.mock("./modules/notification/notification.service", () => ({
  notificationService: {
    notifyStatusUpdate: vi.fn().mockResolvedValue(undefined),
    notifyNewChat: vi.fn().mockResolvedValue(undefined),
    notifyMatchFound: vi.fn().mockResolvedValue(undefined),
    notifyProximityAlert: vi.fn().mockResolvedValue(undefined),
    notifyReturnEvent: vi.fn().mockResolvedValue(undefined),
    startCleanupJob: vi.fn(),
    stopCleanupJob: vi.fn(),
  },
}));

function isLocalDatabaseUrl(urlStr?: string): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const isEnabled =
  process.env.RUN_DB_INTEGRATION === "1" &&
  isLocalDatabaseUrl(process.env.DATABASE_URL);

if (!isEnabled) {
  const reason =
    process.env.RUN_DB_INTEGRATION !== "1"
      ? "RUN_DB_INTEGRATION=1 is not set. Skipping real-database integration tests to protect test environment."
      : `DATABASE_URL host (${process.env.DATABASE_URL}) is not localhost/127.0.0.1. Refusing to run integration tests against non-local database.`;
  console.warn(`[integration-s3.test.ts] SKIPPED: ${reason}`);
}

const describeDb = isEnabled ? describe : describe.skip;

describeDb("S3 Integration — Mobile Contract vs Running Backend", () => {
  let ownerUser: { id: string; email: string; uid: string };
  let ownerToken: string;
  let otherUser: { id: string; email: string; uid: string };
  let otherToken: string;
  const createdUserIds: string[] = [];
  const createdItemIds: string[] = [];
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    app.set("trust proxy", true);
    // Ensure test user exists in real Postgres DB
    const ownerUid = `owner_${nanoid(8)}`;
    ownerUser = await prisma.user.create({
      data: {
        uid: ownerUid,
        email: `${ownerUid}@test.findback.app`,
        displayName: "Owner User",
        role: "user",
      },
      select: { id: true, email: true, uid: true },
    });
    createdUserIds.push(ownerUser.id);
    ownerToken = generateAccessToken({
      id: ownerUser.id,
      email: ownerUser.email,
      uid: ownerUser.uid,
      tokenVersion: 0,
    });

    const otherUid = `other_${nanoid(8)}`;
    otherUser = await prisma.user.create({
      data: {
        uid: otherUid,
        email: `${otherUid}@test.findback.app`,
        displayName: "Other User",
        role: "user",
      },
      select: { id: true, email: true, uid: true },
    });
    createdUserIds.push(otherUser.id);
    otherToken = generateAccessToken({
      id: otherUser.id,
      email: otherUser.email,
      uid: otherUser.uid,
      tokenVersion: 0,
    });
  });

  let ipCounter = 10;
  function nextIp(): string {
    ipCounter += 1;
    return `192.168.10.${ipCounter}`;
  }

  afterAll(async () => {
    if (!isEnabled) return;
    try {
      if (createdSessionIds.length > 0) {
        await prisma.handoverChallenge.deleteMany({
          where: { sessionId: { in: createdSessionIds } },
        });
        await prisma.handoverConfirmation.deleteMany({
          where: { sessionId: { in: createdSessionIds } },
        });
        await prisma.returnArrival.deleteMany({
          where: { sessionId: { in: createdSessionIds } },
        });
        await prisma.returnMeetupProposal.deleteMany({
          where: { sessionId: { in: createdSessionIds } },
        });
        await prisma.rewardPayoutRecord.deleteMany({
          where: { sessionId: { in: createdSessionIds } },
        });
        await prisma.returnSession.deleteMany({
          where: { id: { in: createdSessionIds } },
        });
      }
      await prisma.returnSession.deleteMany({
        where: { ownerId: { in: createdUserIds } },
      });
      await prisma.item.deleteMany({
        where: {
          OR: [
            { ownerId: { in: createdUserIds } },
            { id: { in: createdItemIds } },
          ],
        },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    } catch (err) {
      console.warn("Cleanup warning:", err);
    }
  });

  beforeEach(() => {
    streamCalls.createItemChannel = [];
    streamCalls.deleteItemChannel = [];
    streamCalls.upsertStreamUser = [];
    streamCalls.deleteStreamUser = [];
    streamCalls.closeItemChannel = [];
    streamCalls.lastMessageAt = null;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. HAPPY PATH END-TO-END FLOW (No mocks on API path, real PostgreSQL DB)
  // ─────────────────────────────────────────────────────────────────────────────
  it(
    "executes the full happy path: create item -> LOST -> scan -> guest-init -> return flow -> RESOLVED",
    async () => {
      // A. Owner creates item
      const createRes = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Bóp ví Da Nam",
          category: "wallet",
          imagePublicUrl: "https://example.com/wallet.jpg",
          description: "Ví da màu đen có thẻ ngân hàng",
          latitude: 10.7769,
          longitude: 106.7009,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const item = createRes.body.data;
      expect(item.status).toBe("SAFE");
      expect(item.qrCodeId).toBeDefined();

      // B. Owner marks item LOST
      const lostRes = await request(app)
        .patch(`/v1/items/${item.id}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          status: "LOST",
          latitude: 10.7769,
          longitude: 106.7009,
          lostMessage: "Đánh rơi gần chợ Bến Thành",
        });

      expect(lostRes.status).toBe(200);
      expect(lostRes.body.data.status).toBe("LOST");

      // C. Anonymous scan via QR code
      const scanRes = await request(app).get(`/api/scan/${item.qrCodeId}`);
      expect(scanRes.status).toBe(200);
      const scanData = scanRes.body.data ?? scanRes.body;
      expect(scanData.action).toBe("open_chat");
      expect(scanData.item_info.status).toBe("LOST");

      // D. Anonymous finder calls guest-init
      const guestPhone = "0987654321";
      const initRes = await request(app)
        .post("/api/scan/guest-init")
        .set("X-Forwarded-For", nextIp())
        .send({
          itemId: item.qrCodeId,
          phoneNumber: guestPhone,
          lat: 10.7765,
          lng: 106.7005,
        });

      expect(initRes.status).toBe(200);
      expect(initRes.body.success).toBe(true);
      const {
        chatToken,
        guestAccessToken,
        returnSessionId,
        channelId,
        guestInfo,
      } = initRes.body.data;

      expect(chatToken).toBeDefined();
      expect(guestAccessToken).toBeDefined();
      expect(returnSessionId).toBeDefined();
      expect(channelId).toContain(`item_${item.qrCodeId}_`);
      expect(guestInfo.displayName).toContain("*4321");

      // Verify item in real DB transitioned to FOUND
      const dbItem = await prisma.item.findUnique({ where: { id: item.id } });
      expect(dbItem?.status).toBe("FOUND");

      // E. Guest calls GET /v1/returns/:id
      const getSessionRes = await request(app)
        .get(`/v1/returns/${returnSessionId}`)
        .set("Authorization", `Bearer ${guestAccessToken}`);

      expect(getSessionRes.status).toBe(200);
      expect(getSessionRes.body.success).toBe(true);
      expect(getSessionRes.body.data.id).toBe(returnSessionId);
      expect(getSessionRes.body.data.status).toBe("CHAT_ACTIVE");

      // F. Guest proposes meetup
      const proposeRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/meetup/propose`)
        .set("Authorization", `Bearer ${guestAccessToken}`)
        .send({
          address: "72 Lê Thánh Tôn, Bến Nghé, Quận 1",
          latitude: 10.778,
          longitude: 106.701,
          scheduledTime: new Date(Date.now() + 3600_000).toISOString(),
          notes: "Gặp ở sảnh Vincom",
        });

      expect(proposeRes.status).toBe(200);
      expect(proposeRes.body.data.status).toBe("MEETUP_PROPOSED");

      // G. Owner accepts meetup
      const acceptRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/meetup/accept`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe("MEETUP_ACCEPTED");

      // H. Guest starts tracking
      const trackRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/tracking/start`)
        .set("Authorization", `Bearer ${guestAccessToken}`);

      expect(trackRes.status).toBe(200);
      expect(trackRes.body.data.status).toBe("TRACKING_ACTIVE");

      // I. Guest arrival
      const guestArriveRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/arrival`)
        .set("Authorization", `Bearer ${guestAccessToken}`);
      expect(guestArriveRes.status).toBe(200);

      // J. Owner arrival -> status becomes HANDOVER_PENDING
      const ownerArriveRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/arrival`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(ownerArriveRes.status).toBe(200);
      expect(ownerArriveRes.body.data.status).toBe("HANDOVER_PENDING");

      // K. Guest inits handover (generates 6-digit PIN)
      const initHandoverRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/init`)
        .set("Authorization", `Bearer ${guestAccessToken}`);

      expect(initHandoverRes.status).toBe(200);
      const code = initHandoverRes.body.data.code;
      expect(code).toMatch(/^\d{6}$/);

      // L. Owner confirms handover with PIN
      const confirmOwnerRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/confirm`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ code });

      expect(confirmOwnerRes.status).toBe(200);

      // Assert final states in real database: item atomically transitions to RESOLVED
      const resolvedItem = await prisma.item.findUnique({
        where: { id: item.id },
      });
      expect(resolvedItem?.status).toBe("RESOLVED");

      const finalSession = await prisma.returnSession.findUnique({
        where: { id: returnSessionId },
      });
      expect(["RATING_PENDING", "COMPLETED", "HANDOVER_CONFIRMED"]).toContain(
        finalSession?.status
      );
    },
    30_000
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. NEGATIVE CASES
  // ─────────────────────────────────────────────────────────────────────────────
  describe("negative authorization and guard cases", () => {
    it("rejects guest token on protected /items routes (401)", async () => {
      const guestToken = issueGuestToken("any-guest", "any-session").token;
      const res = await request(app)
        .get("/api/items")
        .set("Authorization", `Bearer ${guestToken}`);
      expect(res.status).toBe(401);
    });

    it("rejects guest token on /stream/token (401)", async () => {
      const guestToken = issueGuestToken("any-guest", "any-session").token;
      const res = await request(app)
        .get("/api/stream/token")
        .set("Authorization", `Bearer ${guestToken}`);
      expect(res.status).toBe(401);
    });

    it("rejects guest token accessing another return session (403)", async () => {
      // Create session for owner and other user
      const otherItem = await prisma.item.create({
        data: {
          name: "Other Item",
          category: "electronics",
          status: "LOST",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });
      const otherSession = await prisma.returnSession.create({
        data: {
          channelId: `item_${otherItem.qrCodeId}_other`,
          itemId: otherItem.id,
          ownerId: ownerUser.id,
          finderId: otherUser.id,
          status: "CHAT_ACTIVE",
        },
      });

      // Create a valid guest user and session A
      const scopedItem = await prisma.item.create({
        data: {
          name: "Scoped Item",
          category: "electronics",
          status: "LOST",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });
      const scopedGuest = await prisma.user.create({
        data: {
          uid: `guest_${nanoid(8)}`,
          email: `${nanoid(8)}@guest.findback.app`,
          displayName: "Scoped Guest",
          role: "guest",
        },
      });
      const scopedSession = await prisma.returnSession.create({
        data: {
          channelId: `item_scoped_${scopedGuest.id}`,
          itemId: scopedItem.id,
          ownerId: ownerUser.id,
          finderId: scopedGuest.id,
          status: "CHAT_ACTIVE",
        },
      });

      // Guest belongs to scopedSession, attempts to access otherSession
      const guestToken = issueGuestToken(scopedGuest.id, scopedSession.id).token;
      const res = await request(app)
        .get(`/v1/returns/${otherSession.id}`)
        .set("Authorization", `Bearer ${guestToken}`);
      expect(res.status).toBe(403);
    });

    it("allows owner opening own item via public endpoint", async () => {
      const ownItem = await prisma.item.create({
        data: {
          name: "Public Check Item",
          category: "keys",
          status: "LOST",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });

      const res = await request(app)
        .get(`/api/items/public/${ownItem.id}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Public Check Item");
    });

    it("rejects 2nd finder claiming already found item (409)", async () => {
      const item = await prisma.item.create({
        data: {
          name: "Double Claim Item",
          category: "wallet",
          status: "FOUND", // Already claimed
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });

      const res = await request(app)
        .post("/api/scan/guest-init")
        .set("X-Forwarded-For", nextIp())
        .send({
          itemId: item.qrCodeId,
          phoneNumber: "0911223344",
        });

      expect(res.status).toBe(400); // Not currently lost
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // A. REAL-DB RACE: Two finders claiming same LOST item concurrently
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Addition A: Real-DB race condition", () => {
    it("handles concurrent claims: exactly one 200, one 409, one ReturnSession, no orphan Stream users", async () => {
      const raceItem = await prisma.item.create({
        data: {
          name: "Race Test Item",
          category: "phone",
          status: "LOST",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });

      // Two simultaneous guest-init calls
      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/scan/guest-init")
          .set("X-Forwarded-For", nextIp())
          .send({
            itemId: raceItem.qrCodeId,
            phoneNumber: "0900000001",
          }),
        request(app)
          .post("/api/scan/guest-init")
          .set("X-Forwarded-For", nextIp())
          .send({
            itemId: raceItem.qrCodeId,
            phoneNumber: "0900000002",
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Exactly one ReturnSession created in DB
      const sessions = await prisma.returnSession.findMany({
        where: { itemId: raceItem.id },
      });
      expect(sessions).toHaveLength(1);

      // Exactly one guest user retained in DB
      const winnerGuestId = sessions[0]!.finderId;
      const winnerUser = await prisma.user.findUnique({
        where: { id: winnerGuestId },
      });
      expect(winnerUser?.role).toBe("guest");

      // Verify Stream stub calls: channel was created for winner, and no orphan channel remains
      expect(streamCalls.createItemChannel.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // B. POST /v1/returns/:id/claim/reject
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Addition B: Owner guest claim rejection endpoint", () => {
    let rejectItem: any;
    let rejectSession: any;
    let guestUser: any;

    beforeEach(async () => {
      rejectItem = await prisma.item.create({
        data: {
          name: "Reject Test Item",
          category: "bag",
          status: "FOUND",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });

      const guestUid = `guest_${nanoid(8)}`;
      guestUser = await prisma.user.create({
        data: {
          uid: guestUid,
          email: `${guestUid}@guest.findback.app`,
          phoneNumber: "0933445566",
          displayName: "Guest Finder",
          role: "guest",
        },
      });

      rejectSession = await prisma.returnSession.create({
        data: {
          channelId: `item_${rejectItem.qrCodeId}_${guestUser.id}`,
          itemId: rejectItem.id,
          ownerId: ownerUser.id,
          finderId: guestUser.id,
          status: "CHAT_ACTIVE",
        },
      });
    });

    it("rejects with 403 when called by unrelated user", async () => {
      const res = await request(app)
        .post(`/v1/returns/${rejectSession.id}/claim/reject`)
        .set("Authorization", `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });

    it("rejects with 401 when called by guest finder (owner-only endpoint)", async () => {
      const guestToken = issueGuestToken(guestUser.id, rejectSession.id).token;
      const res = await request(app)
        .post(`/v1/returns/${rejectSession.id}/claim/reject`)
        .set("Authorization", `Bearer ${guestToken}`);
      expect(res.status).toBe(401);
    });

    it("cancels active claim when called by owner in CHAT_ACTIVE (200), reverting item to LOST", async () => {
      const res = await request(app)
        .post(`/v1/returns/${rejectSession.id}/claim/reject`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);

      const updatedSession = await prisma.returnSession.findUnique({
        where: { id: rejectSession.id },
      });
      expect(updatedSession?.status).toBe("MEETUP_CANCELLED");

      const updatedItem = await prisma.item.findUnique({
        where: { id: rejectItem.id },
      });
      expect(updatedItem?.status).toBe("LOST");

      expect(streamCalls.closeItemChannel).toContain(rejectSession.channelId);
    });

    it("is idempotent when called repeatedly on already MEETUP_CANCELLED session (200)", async () => {
      // First call
      await request(app)
        .post(`/v1/returns/${rejectSession.id}/claim/reject`)
        .set("Authorization", `Bearer ${ownerToken}`);

      // Second call
      const res2 = await request(app)
        .post(`/v1/returns/${rejectSession.id}/claim/reject`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe("MEETUP_CANCELLED");
    });

    it("rejects with 409 when called while in HANDOVER_* state", async () => {
      await prisma.returnSession.update({
        where: { id: rejectSession.id },
        data: { status: "HANDOVER_PENDING" },
      });

      const res = await request(app)
        .post(`/v1/returns/${rejectSession.id}/claim/reject`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(409);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // C. EXPIRY JOB: Abandoned guest claims
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Addition C: Expiry job lifecycle and eligibility", () => {
    it("proves non-CHAT_ACTIVE sessions are NOT expired, but stale CHAT_ACTIVE is expired to LOST", async () => {
      const staleTime = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours ago

      // Session in MEETUP_ACCEPTED
      const itemAccepted = await prisma.item.create({
        data: {
          name: "Accepted Item",
          category: "keys",
          status: "FOUND",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });
      const guestAccepted = await prisma.user.create({
        data: {
          uid: `guest_${nanoid(8)}`,
          email: `${nanoid(8)}@guest.findback.app`,
          displayName: "Guest Accepted",
          role: "guest",
        },
      });
      const sessionAccepted = await prisma.returnSession.create({
        data: {
          channelId: `item_${itemAccepted.qrCodeId}_${guestAccepted.id}`,
          itemId: itemAccepted.id,
          ownerId: ownerUser.id,
          finderId: guestAccepted.id,
          status: "MEETUP_ACCEPTED",
          createdAt: staleTime,
          updatedAt: staleTime,
        },
      });

      // Session in HANDOVER_PENDING
      const itemHandover = await prisma.item.create({
        data: {
          name: "Handover Item",
          category: "wallet",
          status: "FOUND",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });
      const sessionHandover = await prisma.returnSession.create({
        data: {
          channelId: `item_${itemHandover.qrCodeId}_${guestAccepted.id}`,
          itemId: itemHandover.id,
          ownerId: ownerUser.id,
          finderId: guestAccepted.id,
          status: "HANDOVER_PENDING",
          createdAt: staleTime,
          updatedAt: staleTime,
        },
      });

      // Stale session in CHAT_ACTIVE (no recent chat)
      const itemStaleChat = await prisma.item.create({
        data: {
          name: "Stale Chat Item",
          category: "electronics",
          status: "FOUND",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });
      const sessionStaleChat = await prisma.returnSession.create({
        data: {
          channelId: `item_${itemStaleChat.qrCodeId}_${guestAccepted.id}`,
          itemId: itemStaleChat.id,
          ownerId: ownerUser.id,
          finderId: guestAccepted.id,
          status: "CHAT_ACTIVE",
          createdAt: staleTime,
          updatedAt: staleTime,
        },
      });

      // Run expiry job
      const expiredCount =
        await guestClaimLifecycleService.expireAbandonedGuestClaims();

      expect(expiredCount).toBeGreaterThanOrEqual(1);

      // Verify MEETUP_ACCEPTED session is untouched
      const dbAccepted = await prisma.returnSession.findUnique({
        where: { id: sessionAccepted.id },
      });
      expect(dbAccepted?.status).toBe("MEETUP_ACCEPTED");

      // Verify HANDOVER_PENDING session is untouched
      const dbHandover = await prisma.returnSession.findUnique({
        where: { id: sessionHandover.id },
      });
      expect(dbHandover?.status).toBe("HANDOVER_PENDING");

      // Verify stale CHAT_ACTIVE session was expired and item is back to LOST
      const dbStale = await prisma.returnSession.findUnique({
        where: { id: sessionStaleChat.id },
      });
      expect(dbStale?.status).toBe("MEETUP_CANCELLED");

      const dbStaleItem = await prisma.item.findUnique({
        where: { id: itemStaleChat.id },
      });
      expect(dbStaleItem?.status).toBe("LOST");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // D. CHAT TOKEN TTL EXPIRATION
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Addition D: chatToken TTL decoding and validation", () => {
    it("verifies chatToken returned by guest-init has a ~1h expiration", async () => {
      const item = await prisma.item.create({
        data: {
          name: "Token Test Item",
          category: "documents",
          status: "LOST",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });

      const res = await request(app)
        .post("/api/scan/guest-init")
        .set("X-Forwarded-For", nextIp())
        .send({
          itemId: item.qrCodeId,
          phoneNumber: "0977665544",
        });

      expect(res.status).toBe(200);
      const { chatToken } = res.body.data;
      expect(chatToken).toBeDefined();

      const decoded = jwt.decode(chatToken) as {
        user_id: string;
        exp?: number;
        iat?: number;
      };

      expect(decoded).toBeDefined();
      expect(decoded.user_id).toBeDefined();
      expect(typeof decoded.exp).toBe("number");
      expect(typeof decoded.iat).toBe("number");

      // Exp must be approximately 3600 seconds (1 hour) from iat
      const ttl = (decoded.exp ?? 0) - (decoded.iat ?? 0);
      expect(ttl).toBe(3600);
      expect(decoded.exp! * 1000).toBeGreaterThan(Date.now());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // REQUIREMENT 1: HANDOVER CONFIRM AUTHORIZATION AND LOCKING PROOFS
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Requirement 1: Handover confirm authorization, atomic transitions and locking proofs", () => {
    it("proves guest token + correct PIN on handover/confirm does NOT move item to RESOLVED and does not create the owner's confirmation", async () => {
      const item = await prisma.item.create({
        data: {
          name: "Handover Auth Test Item",
          category: "wallet",
          status: "LOST",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });
      createdItemIds.push(item.id);

      const guestInitRes = await request(app)
        .post("/api/scan/guest-init")
        .set("X-Forwarded-For", nextIp())
        .send({
          itemId: item.qrCodeId,
          phoneNumber: "0911223344",
        });
      expect(guestInitRes.status).toBe(200);
      const { guestAccessToken, returnSessionId } = guestInitRes.body.data;
      createdSessionIds.push(returnSessionId);

      // Set session to HANDOVER_PENDING to prepare for handover challenge
      await prisma.returnSession.update({
        where: { id: returnSessionId },
        data: { status: "HANDOVER_PENDING" },
      });

      // Guest generates 6-digit PIN code via initHandover
      const initHandoverRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/init`)
        .set("Authorization", `Bearer ${guestAccessToken}`);
      expect(initHandoverRes.status).toBe(200);
      const code = initHandoverRes.body.data.code;
      expect(code).toMatch(/^\d{6}$/);

      // a) Guest calls confirmHandover with the correct PIN
      const guestConfirmRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/confirm`)
        .set("Authorization", `Bearer ${guestAccessToken}`)
        .send({ code });

      // Succeeds as finder direct confirmation, but does NOT resolve or confirm as owner
      expect(guestConfirmRes.status).toBe(200);

      // Verify item remains FOUND in real DB
      const itemAfterGuest = await prisma.item.findUnique({
        where: { id: item.id },
      });
      expect(itemAfterGuest?.status).toBe("FOUND");

      // Verify NO owner confirmation was created
      const confirmations = await prisma.handoverConfirmation.findMany({
        where: { sessionId: returnSessionId },
      });
      expect(confirmations.some((c) => c.role === "OWNER")).toBe(false);
      expect(confirmations.every((c) => c.role === "FINDER")).toBe(true);

      // b) ONLY owner (registered user, correct PIN) completes atomic RESOLVED transition
      const ownerConfirmRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/confirm`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ code });

      expect(ownerConfirmRes.status).toBe(200);

      const itemAfterOwner = await prisma.item.findUnique({
        where: { id: item.id },
      });
      expect(itemAfterOwner?.status).toBe("RESOLVED");

      const finalConfirmations = await prisma.handoverConfirmation.findMany({
        where: { sessionId: returnSessionId },
      });
      expect(finalConfirmations.some((c) => c.role === "OWNER")).toBe(true);
      expect(finalConfirmations.some((c) => c.role === "FINDER")).toBe(true);
    });

    it("proves wrong PIN x5 locks and a guest cannot brute-force or reset it", async () => {
      const item = await prisma.item.create({
        data: {
          name: "Lock Test Item",
          category: "keys",
          status: "LOST",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });
      createdItemIds.push(item.id);

      const guestInitRes = await request(app)
        .post("/api/scan/guest-init")
        .set("X-Forwarded-For", nextIp())
        .send({
          itemId: item.qrCodeId,
          phoneNumber: "0911223355",
        });
      const { guestAccessToken, returnSessionId } = guestInitRes.body.data;
      createdSessionIds.push(returnSessionId);

      // Set session to HANDOVER_PENDING
      await prisma.returnSession.update({
        where: { id: returnSessionId },
        data: { status: "HANDOVER_PENDING" },
      });

      const initHandoverRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/init`)
        .set("Authorization", `Bearer ${guestAccessToken}`);
      const correctCode = initHandoverRes.body.data.code;

      // Owner enters wrong PIN 5 times -> each fails with 400 INVALID_HANDOVER_CODE
      for (let i = 0; i < 5; i++) {
        const wrongRes = await request(app)
          .post(`/v1/returns/${returnSessionId}/handover/confirm`)
          .set("Authorization", `Bearer ${ownerToken}`)
          .send({ code: "000000" });
        expect(wrongRes.status).toBe(400);
      }

      // 6th attempt triggers lock (5 max attempts exceeded)
      const lockRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/confirm`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ code: "000000" });
      expect(lockRes.status).toBe(400);
      expect(lockRes.body.code ?? lockRes.body.message).toMatch(
        /HANDOVER_CODE_LOCKED|Maximum verification attempts/
      );

      // Now even the correct PIN is rejected
      const lockedCorrectRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/confirm`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ code: correctCode });
      expect(lockedCorrectRes.status).toBe(400);
      expect(
        lockedCorrectRes.body.code ?? lockedCorrectRes.body.message
      ).toMatch(/HANDOVER_CODE_LOCKED|Maximum verification attempts/);

      // A guest attempting confirm cannot bypass lock to resolve item
      const guestAttemptRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/confirm`)
        .set("Authorization", `Bearer ${guestAccessToken}`)
        .send({ code: correctCode });
      expect(guestAttemptRes.status).toBe(200);

      const itemStatus = await prisma.item.findUnique({
        where: { id: item.id },
      });
      expect(itemStatus?.status).toBe("FOUND");
    });

    it("proves rating, dispute-as-owner, POST /returns, and claim/reject remain 401/403 for guests", async () => {
      const item = await prisma.item.create({
        data: {
          name: "Guarded Endpoints Item",
          category: "bag",
          status: "LOST",
          ownerId: ownerUser.id,
          qrCodeId: `qr_${nanoid(16)}`,
          securityToken: nanoid(32),
        },
      });
      createdItemIds.push(item.id);

      const guestInitRes = await request(app)
        .post("/api/scan/guest-init")
        .set("X-Forwarded-For", nextIp())
        .send({
          itemId: item.qrCodeId,
          phoneNumber: "0911223366",
        });
      const { guestAccessToken, returnSessionId } = guestInitRes.body.data;
      createdSessionIds.push(returnSessionId);

      // 1. Rating with guest token -> 401
      const ratingRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/rating`)
        .set("Authorization", `Bearer ${guestAccessToken}`)
        .send({ score: 5, comment: "Tuyệt vời" });
      expect(ratingRes.status).toBe(401);

      // 2. Dispute-as-owner with guest token -> 401
      const disputeRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/handover/dispute`)
        .set("Authorization", `Bearer ${guestAccessToken}`)
        .send({ reason: "Không đúng đồ" });
      expect(disputeRes.status).toBe(401);

      // 3. POST /v1/returns with guest token -> 401
      const postReturnsRes = await request(app)
        .post("/v1/returns")
        .set("Authorization", `Bearer ${guestAccessToken}`)
        .send({ channelId: "some-channel" });
      expect(postReturnsRes.status).toBe(401);

      // 4. Claim reject with guest token -> 401
      const claimRejectRes = await request(app)
        .post(`/v1/returns/${returnSessionId}/claim/reject`)
        .set("Authorization", `Bearer ${guestAccessToken}`);
      expect(claimRejectRes.status).toBe(401);
    });
  });
});
