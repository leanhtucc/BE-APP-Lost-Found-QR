import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { assertPhase4TestDatabaseSafety } from "../../config/phase4-test-safety";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const testDatabaseUrl = process.env.PHASE4_TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);

integration("Phase 4 PostgreSQL/service integration", () => {
  let db: PrismaClient;
  let returnService: any;
  let foundService: any;
  let streamService: any;
  let socketModule: any;
  let redis: any;
  const closeItemChannel = vi.fn();
  const createReturnChannel = vi.fn();

  const createUser = (suffix: string) =>
    db.user.create({
      data: {
        id: `phase4_user_${suffix}`,
        uid: `phase4_uid_${suffix}`,
        memberId: `phase4_member_${suffix}`,
        displayName: suffix,
        email: `phase4_${suffix}@example.test`,
        isVerified: true,
      },
    });

  beforeAll(async () => {
    assertPhase4TestDatabaseSafety({
      databaseUrl: testDatabaseUrl,
      directUrl: testDatabaseUrl,
      testDatabaseUrl,
      productionDatabaseUrl: process.env.PHASE4_PRODUCTION_DATABASE_URL,
      explicitlyConfirmed:
        process.env.PHASE4_TEST_DATABASE_CONFIRMED === "true",
    });
    process.env.DATABASE_URL = testDatabaseUrl!;
    process.env.NODE_ENV = "test";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.REDIS_URL;
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
    });
    await db.$connect();

    vi.doMock("../../libs/prisma", () => ({ prisma: db }));
    vi.doMock("../../libs/stream-chat", () => ({
      closeItemChannel,
      createReturnChannel,
      upsertStreamUser: vi.fn(),
    }));
    vi.doMock("../../socket/radar.socket", () => ({
      emitLostItemRemovedToNearbyUsers: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("../notification/notification.service", () => ({
      notificationService: { notifyReturnEvent: vi.fn() },
    }));

    returnService = (await import("./return.service.js")).returnService;
    foundService = await import("../found-report/found-report.service.js");
    streamService = await import("../stream/stream.service.js");
    socketModule = await import("../../socket/return.socket.js");
    redis = (await import("../../libs/redis.js")).redis;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    createReturnChannel.mockResolvedValue({
      channelId: "ok",
      channelType: "messaging",
    });
    closeItemChannel.mockResolvedValue(undefined);
    await db.user.deleteMany({ where: { uid: { startsWith: "phase4_uid_" } } });
  });

  afterAll(async () => {
    if (db) {
      await db.user.deleteMany({
        where: { uid: { startsWith: "phase4_uid_" } },
      });
      await db.$disconnect();
    }
  });

  it("enforces exactly one return source in PostgreSQL", async () => {
    const [owner, finder] = await Promise.all([
      createUser("constraint_owner"),
      createUser("constraint_finder"),
    ]);
    const item = await db.item.create({
      data: {
        ownerId: owner.id,
        name: "Item",
        category: "other",
        securityToken: "phase4_sec_constraint",
        qrCodeId: "phase4_qr_constraint",
      },
    });
    const report = await db.foundReport.create({
      data: {
        finderId: finder.id,
        idempotencyKey: "phase4-found-constraint",
        name: "Found",
        category: "other",
        imagePublicUrl: "https://example.test/a.jpg",
        lat: 1,
        lng: 1,
        address: "Test",
      },
    });

    await expect(
      db.returnSession.create({
        data: {
          channelId: "phase4_valid_item",
          itemId: item.id,
          ownerId: owner.id,
          finderId: finder.id,
        },
      })
    ).resolves.toBeTruthy();
    await expect(
      db.returnSession.create({
        data: {
          channelId: "phase4_valid_found",
          foundReportId: report.id,
          ownerId: owner.id,
          finderId: finder.id,
        },
      })
    ).resolves.toBeTruthy();
    await expect(
      db.returnSession.create({
        data: {
          channelId: "phase4_invalid_none",
          ownerId: owner.id,
          finderId: finder.id,
        },
      })
    ).rejects.toThrow();
    await expect(
      db.returnSession.create({
        data: {
          channelId: "phase4_invalid_both",
          itemId: item.id,
          foundReportId: report.id,
          ownerId: owner.id,
          finderId: finder.id,
        },
      })
    ).rejects.toThrow();
  });

  it("accepts exactly one of two concurrent found-report claims", async () => {
    const [finder, a, b] = await Promise.all([
      createUser("claim_finder"),
      createUser("claim_a"),
      createUser("claim_b"),
    ]);
    const report = await db.foundReport.create({
      data: {
        finderId: finder.id,
        idempotencyKey: "phase4-found-race",
        name: "Found",
        category: "other",
        imagePublicUrl: "https://example.test/found.jpg",
        lat: 1,
        lng: 1,
        address: "Test",
      },
    });
    const [claimA, claimB] = await Promise.all([
      db.foundReportClaim.create({
        data: {
          foundReportId: report.id,
          claimantId: a.id,
          ownershipProof: "private proof A",
        },
      }),
      db.foundReportClaim.create({
        data: {
          foundReportId: report.id,
          claimantId: b.id,
          ownershipProof: "private proof B",
        },
      }),
    ]);

    const attempts = await Promise.allSettled([
      foundService.acceptFoundReportClaim(finder.id, report.id, claimA.id),
      foundService.acceptFoundReportClaim(finder.id, report.id, claimB.id),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      await db.foundReportClaim.count({
        where: { foundReportId: report.id, status: "ACCEPTED" },
      })
    ).toBe(1);
    expect(
      await db.returnSession.count({ where: { foundReportId: report.id } })
    ).toBe(1);
    const createdSession = await db.returnSession.findFirstOrThrow({
      where: { foundReportId: report.id },
    });
    expect(createdSession.itemId).toBeNull();
    expect(createdSession.foundReportId).toBe(report.id);
    expect(createReturnChannel).toHaveBeenCalledTimes(1);
  });

  it("rejects resubmission after a claim is rejected or withdrawn", async () => {
    const [finder, rejectedClaimant, withdrawnClaimant] = await Promise.all([
      createUser("resubmit_finder"),
      createUser("resubmit_rejected"),
      createUser("resubmit_withdrawn"),
    ]);
    const report = await db.foundReport.create({
      data: {
        finderId: finder.id,
        idempotencyKey: "phase4-resubmit-policy",
        name: "Found",
        category: "other",
        imagePublicUrl: "https://example.test/resubmit.jpg",
        lat: 1,
        lng: 1,
        address: "Test",
      },
    });
    await Promise.all([
      db.foundReportClaim.create({
        data: {
          foundReportId: report.id,
          claimantId: rejectedClaimant.id,
          ownershipProof: "original rejected proof",
          status: "REJECTED",
        },
      }),
      db.foundReportClaim.create({
        data: {
          foundReportId: report.id,
          claimantId: withdrawnClaimant.id,
          ownershipProof: "original withdrawn proof",
          status: "WITHDRAWN",
        },
      }),
    ]);

    for (const claimant of [rejectedClaimant, withdrawnClaimant]) {
      await expect(
        foundService.createFoundReportClaim(
          claimant.id,
          report.id,
          "corrected ownership proof"
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "FOUND_REPORT_CLAIM_ALREADY_EXISTS",
      });
    }
    expect(
      await db.foundReportClaim.count({ where: { foundReportId: report.id } })
    ).toBe(2);
  });

  it("recovers a DB-first LOST claim after Stream failure and prevents an orphan channel on DB failure", async () => {
    const [owner, finder] = await Promise.all([
      createUser("stream_owner"),
      createUser("stream_finder"),
    ]);
    const item = await db.item.create({
      data: {
        ownerId: owner.id,
        name: "Lost",
        category: "other",
        status: "LOST",
        securityToken: "phase4_sec_stream",
        qrCodeId: "phase4_qr_stream",
      },
    });
    createReturnChannel.mockRejectedValueOnce(new Error("Stream unavailable"));
    await expect(
      streamService.createLostItemReturnChannel(finder.id, item.id)
    ).rejects.toThrow("Stream unavailable");
    expect(await db.returnSession.count({ where: { itemId: item.id } })).toBe(
      1
    );
    expect(
      (await db.item.findUniqueOrThrow({ where: { id: item.id } })).status
    ).toBe("FOUND");

    createReturnChannel.mockResolvedValueOnce({
      channelId: "recovered",
      channelType: "messaging",
    });
    await expect(
      streamService.createLostItemReturnChannel(finder.id, item.id)
    ).resolves.toBeTruthy();
    expect(await db.returnSession.count({ where: { itemId: item.id } })).toBe(
      1
    );

    createReturnChannel.mockClear();
    await expect(
      streamService.createLostItemReturnChannel(finder.id, "missing-item")
    ).rejects.toThrow();
    expect(createReturnChannel).not.toHaveBeenCalled();
  });

  it("allows only one of two finders to claim the same LOST item", async () => {
    const [owner, a, b] = await Promise.all([
      createUser("lost_owner"),
      createUser("lost_a"),
      createUser("lost_b"),
    ]);
    const item = await db.item.create({
      data: {
        ownerId: owner.id,
        name: "Lost race",
        category: "other",
        status: "LOST",
        securityToken: "phase4_sec_lost_race",
        qrCodeId: "phase4_qr_lost_race",
      },
    });
    const results = await Promise.allSettled([
      streamService.createLostItemReturnChannel(a.id, item.id),
      streamService.createLostItemReturnChannel(b.id, item.id),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(await db.returnSession.count({ where: { itemId: item.id } })).toBe(
      1
    );
    expect(createReturnChannel).toHaveBeenCalledTimes(1);
  });

  it("uses the real serializer to hide pending/revoked coordinates and all PIN material", async () => {
    const [owner, finder] = await Promise.all([
      createUser("privacy_owner"),
      createUser("privacy_finder"),
    ]);
    const item = await db.item.create({
      data: {
        ownerId: owner.id,
        name: "Private",
        category: "other",
        status: "FOUND",
        securityToken: "phase4_sec_privacy",
        qrCodeId: "phase4_qr_privacy",
      },
    });
    const session = await db.returnSession.create({
      data: {
        channelId: "phase4_privacy",
        itemId: item.id,
        ownerId: owner.id,
        finderId: finder.id,
        status: "MEETUP_PROPOSED",
        meetupProposals: {
          create: {
            proposedBy: owner.id,
            address: "Private address",
            latitude: 10.123,
            longitude: 106.456,
            scheduledTime: "ASAP",
          },
        },
      },
    });
    const pending = await returnService.getSession(owner.id, session.id);
    expect(pending.meetup).not.toBeNull();
    expect(pending.meetup).not.toHaveProperty("latitude");
    expect(pending.meetup).not.toHaveProperty("longitude");
    expect(JSON.stringify(pending)).not.toMatch(
      /codeHash|qrPayload|"code"|"pin"/i
    );
    await expect(
      returnService.getSession("unrelated", session.id)
    ).rejects.toMatchObject({ statusCode: 403 });

    await db.returnMeetupProposal.updateMany({
      where: { sessionId: session.id },
      data: { status: "ACCEPTED" },
    });
    await db.returnSession.update({
      where: { id: session.id },
      data: { status: "MEETUP_ACCEPTED" },
    });
    const accepted = await returnService.getSession(owner.id, session.id);
    expect(accepted.meetup).toMatchObject({
      latitude: 10.123,
      longitude: 106.456,
    });

    for (const status of [
      "MEETUP_CANCELLED",
      "TRACKING_EXPIRED",
      "HANDOVER_DISPUTED",
      "COMPLETED",
    ] as const) {
      await db.returnSession.update({
        where: { id: session.id },
        data: { status },
      });
      expect(
        (await returnService.getSession(owner.id, session.id)).meetup
      ).toBeNull();
    }
  });

  it("keeps the one-time PIN on the authorized init path and enforces attempt locking", async () => {
    const [owner, finder, stranger] = await Promise.all([
      createUser("pin_owner"),
      createUser("pin_finder"),
      createUser("pin_stranger"),
    ]);
    const item = await db.item.create({
      data: {
        ownerId: owner.id,
        name: "PIN",
        category: "other",
        status: "FOUND",
        securityToken: "phase4_sec_pin",
        qrCodeId: "phase4_qr_pin",
      },
    });
    const session = await db.returnSession.create({
      data: {
        channelId: "phase4_pin",
        itemId: item.id,
        ownerId: owner.id,
        finderId: finder.id,
        status: "HANDOVER_PENDING",
      },
    });

    const init = await returnService.initHandover(finder.id, session.id);
    expect(init.code).toMatch(/^\d{6}$/);
    expect(init.qrPayload).toContain(init.code);
    await expect(
      returnService.initHandover(owner.id, session.id)
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      returnService.initHandover(stranger.id, session.id)
    ).rejects.toMatchObject({ statusCode: 403 });
    const socketEmit = vi.fn();
    socketModule.setReturnSocketServer({
      to: () => ({ emit: socketEmit }),
    } as any);
    socketModule.emitReturnSessionUpdated(
      session.id,
      await returnService.getSession(owner.id, session.id)
    );
    expect(JSON.stringify(socketEmit.mock.calls)).not.toMatch(
      /codeHash|qrPayload|"code"|"pin"/i
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        returnService.confirmHandover(owner.id, session.id, { code: "000000" })
      ).rejects.toBeTruthy();
    }
    await expect(
      returnService.confirmHandover(owner.id, session.id, { code: init.code })
    ).rejects.toMatchObject({ code: "HANDOVER_CODE_LOCKED" });
    expect(
      (
        await db.handoverChallenge.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).attemptCount
    ).toBe(5);
  });

  it("runs authorization, state, expiry, and coordinate checks through the real socket handler", async () => {
    const [owner, finder, stranger] = await Promise.all([
      createUser("socket_owner"),
      createUser("socket_finder"),
      createUser("socket_stranger"),
    ]);
    const item = await db.item.create({
      data: {
        ownerId: owner.id,
        name: "Socket",
        category: "other",
        status: "FOUND",
        securityToken: "phase4_sec_socket",
        qrCodeId: "phase4_qr_socket",
      },
    });
    const session = await db.returnSession.create({
      data: {
        channelId: "phase4_socket",
        itemId: item.id,
        ownerId: owner.id,
        finderId: finder.id,
        status: "CHAT_ACTIVE",
      },
    });

    const makeSocket = (userId: string) => {
      const handlers = new Map<string, Function>();
      const rooms = new Set<string>();
      const socket: any = {
        data: { userId },
        rooms,
        on: (event: string, handler: Function) => handlers.set(event, handler),
        join: async (room: string) => rooms.add(room),
        leave: async (room: string) => rooms.delete(room),
        to: () => ({ emit: vi.fn() }),
      };
      socketModule.registerReturnSocketHandlers(socket, {
        to: () => ({ emit: vi.fn() }),
      } as any);
      const invoke = (event: string, payload: unknown) =>
        new Promise<any>((resolve) => handlers.get(event)!(payload, resolve));
      return { rooms, invoke };
    };
    const location = {
      latitude: 10,
      longitude: 106,
      capturedAt: new Date().toISOString(),
    };

    const unrelated = makeSocket(stranger.id);
    unrelated.rooms.add(socketModule.toReturnRoomKey(session.id));
    expect(
      (
        await unrelated.invoke("return:update-location", {
          sessionId: session.id,
          location,
        })
      ).success
    ).toBe(false);

    const participant = makeSocket(owner.id);
    expect(
      (
        await participant.invoke("return:update-location", {
          sessionId: session.id,
          location,
        })
      ).success
    ).toBe(false);
    expect(
      (await participant.invoke("return:join", { sessionId: session.id }))
        .success
    ).toBe(true);
    expect(
      (
        await participant.invoke("return:update-location", {
          sessionId: session.id,
          location,
        })
      ).success
    ).toBe(false);

    await db.returnSession.update({
      where: { id: session.id },
      data: {
        status: "TRACKING_ACTIVE",
        trackingExpiresAt: new Date(Date.now() - 1000),
      },
    });
    await redis.set(
      `return:loc:${session.id}:${owner.id}`,
      { latitude: 10 },
      120
    );
    await redis.set(
      `return:loc:${session.id}:${finder.id}`,
      { latitude: 11 },
      120
    );
    expect(
      (
        await participant.invoke("return:update-location", {
          sessionId: session.id,
          location,
        })
      ).success
    ).toBe(false);
    expect(
      (await db.returnSession.findUniqueOrThrow({ where: { id: session.id } }))
        .status
    ).toBe("TRACKING_EXPIRED");
    expect(await redis.get(`return:loc:${session.id}:${owner.id}`)).toBeNull();
    expect(await redis.get(`return:loc:${session.id}:${finder.id}`)).toBeNull();

    await db.returnSession.update({
      where: { id: session.id },
      data: {
        status: "TRACKING_ACTIVE",
        trackingExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(
      (
        await participant.invoke("return:update-location", {
          sessionId: session.id,
          location: { ...location, latitude: 999 },
        })
      ).success
    ).toBe(false);
    expect(
      (
        await participant.invoke("return:update-location", {
          sessionId: session.id,
          location,
        })
      ).success
    ).toBe(true);

    for (const status of [
      "MEETUP_CANCELLED",
      "COMPLETED",
      "HANDOVER_DISPUTED",
    ] as const) {
      await db.returnSession.update({
        where: { id: session.id },
        data: { status },
      });
      expect(
        (
          await participant.invoke("return:update-location", {
            sessionId: session.id,
            location,
          })
        ).success
      ).toBe(false);
    }
  });

  it("deletes both Redis location keys and emits a safe clear event on cancel and dispute", async () => {
    const [owner, finder] = await Promise.all([
      createUser("cleanup_owner"),
      createUser("cleanup_finder"),
    ]);
    const item = await db.item.create({
      data: {
        ownerId: owner.id,
        name: "Cleanup",
        category: "other",
        status: "FOUND",
        securityToken: "phase4_sec_cleanup",
        qrCodeId: "phase4_qr_cleanup",
      },
    });
    const emit = vi.fn();
    socketModule.setReturnSocketServer({ to: () => ({ emit }) } as any);

    const cancelled = await db.returnSession.create({
      data: {
        channelId: "phase4_cleanup_cancel",
        itemId: item.id,
        ownerId: owner.id,
        finderId: finder.id,
        status: "MEETUP_ACCEPTED",
        meetupProposals: {
          create: {
            proposedBy: owner.id,
            address: "Accepted",
            latitude: 10,
            longitude: 106,
            scheduledTime: "ASAP",
            status: "ACCEPTED",
          },
        },
      },
    });
    await redis.set(
      `return:loc:${cancelled.id}:${owner.id}`,
      { latitude: 10 },
      120
    );
    await redis.set(
      `return:loc:${cancelled.id}:${finder.id}`,
      { latitude: 11 },
      120
    );
    await returnService.cancelReturn(owner.id, cancelled.id);
    expect(
      await redis.get(`return:loc:${cancelled.id}:${owner.id}`)
    ).toBeNull();
    expect(
      await redis.get(`return:loc:${cancelled.id}:${finder.id}`)
    ).toBeNull();

    const disputed = await db.returnSession.create({
      data: {
        channelId: "phase4_cleanup_dispute",
        itemId: item.id,
        ownerId: owner.id,
        finderId: finder.id,
        status: "HANDOVER_PENDING",
      },
    });
    await redis.set(
      `return:loc:${disputed.id}:${owner.id}`,
      { latitude: 10 },
      120
    );
    await redis.set(
      `return:loc:${disputed.id}:${finder.id}`,
      { latitude: 11 },
      120
    );
    await returnService.disputeHandover(owner.id, disputed.id, {
      reason: "Test dispute",
    });
    expect(await redis.get(`return:loc:${disputed.id}:${owner.id}`)).toBeNull();
    expect(
      await redis.get(`return:loc:${disputed.id}:${finder.id}`)
    ).toBeNull();
    expect(
      emit.mock.calls.some(
        (call) =>
          call[0] === "return:location-cleared" &&
          !JSON.stringify(call[1]).match(/latitude|longitude|code|pin/i)
      )
    ).toBe(true);
  });

  it("completes FOUND_REPORT without creating payout or fake Item", async () => {
    const [owner, finder] = await Promise.all([
      createUser("complete_found_owner"),
      createUser("complete_found_finder"),
    ]);
    const report = await db.foundReport.create({
      data: {
        finderId: finder.id,
        idempotencyKey: "phase4-complete-found",
        name: "Found",
        category: "other",
        imagePublicUrl: "https://example.test/f.jpg",
        lat: 1,
        lng: 1,
        address: "Test",
      },
    });
    const session = await db.returnSession.create({
      data: {
        channelId: "phase4_complete_found",
        foundReportId: report.id,
        ownerId: owner.id,
        finderId: finder.id,
        status: "HANDOVER_PENDING",
        handoverChallenge: {
          create: {
            codeHash: returnService.hashCode("123456"),
            expiresAt: new Date(Date.now() + 60_000),
            createdForUserId: finder.id,
          },
        },
      },
    });
    await redis.set(
      `return:loc:${session.id}:${owner.id}`,
      { latitude: 10 },
      120
    );
    await redis.set(
      `return:loc:${session.id}:${finder.id}`,
      { latitude: 11 },
      120
    );
    await returnService.confirmHandover(finder.id, session.id, {});
    const result = await returnService.confirmHandover(owner.id, session.id, {
      code: "123456",
    });
    expect(result.status).toBe("RATING_PENDING");
    expect(
      (await db.foundReport.findUniqueOrThrow({ where: { id: report.id } }))
        .resolvedAt
    ).not.toBeNull();
    expect(
      await db.rewardPayoutRecord.count({ where: { sessionId: session.id } })
    ).toBe(0);
    expect(await db.item.count({ where: { ownerId: owner.id } })).toBe(0);
    expect(await redis.get(`return:loc:${session.id}:${owner.id}`)).toBeNull();
    expect(await redis.get(`return:loc:${session.id}:${finder.id}`)).toBeNull();
  });

  it("keeps ITEM escrow/payout completion intact", async () => {
    const [owner, finder] = await Promise.all([
      createUser("complete_item_owner"),
      createUser("complete_item_finder"),
    ]);
    const item = await db.item.create({
      data: {
        ownerId: owner.id,
        name: "Lost",
        category: "other",
        status: "FOUND",
        securityToken: "phase4_sec_complete_item",
        qrCodeId: "phase4_qr_complete_item",
      },
    });
    const post = await db.post.create({
      data: {
        ownerId: owner.id,
        itemId: item.id,
        lat: 1,
        lng: 1,
        bountyAmount: 100000,
        status: "FOUND",
        escrowTransactions: {
          create: {
            amount: 100000,
            provider: "VNPAY",
            status: "HOLDING",
            transactionCode: "phase4_escrow_item",
          },
        },
      },
    });
    const session = await db.returnSession.create({
      data: {
        channelId: "phase4_complete_item",
        itemId: item.id,
        reportId: post.id,
        ownerId: owner.id,
        finderId: finder.id,
        status: "HANDOVER_PENDING",
        handoverChallenge: {
          create: {
            codeHash: returnService.hashCode("654321"),
            expiresAt: new Date(Date.now() + 60_000),
            createdForUserId: finder.id,
          },
        },
      },
    });
    await redis.set(
      `return:loc:${session.id}:${owner.id}`,
      { latitude: 10 },
      120
    );
    await redis.set(
      `return:loc:${session.id}:${finder.id}`,
      { latitude: 11 },
      120
    );
    await returnService.confirmHandover(finder.id, session.id, {});
    const result = await returnService.confirmHandover(owner.id, session.id, {
      code: "654321",
    });
    expect(result.status).toBe("RATING_PENDING");
    expect(
      (await db.item.findUniqueOrThrow({ where: { id: item.id } })).status
    ).toBe("RESOLVED");
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: post.id } })).status
    ).toBe("COMPLETED");
    expect(
      await db.rewardPayoutRecord.count({ where: { sessionId: session.id } })
    ).toBe(1);
    expect(
      (
        await db.escrowTransaction.findFirstOrThrow({
          where: { postId: post.id },
        })
      ).status
    ).toBe("RELEASED");
    expect(await redis.get(`return:loc:${session.id}:${owner.id}`)).toBeNull();
    expect(await redis.get(`return:loc:${session.id}:${finder.id}`)).toBeNull();
  });
});
