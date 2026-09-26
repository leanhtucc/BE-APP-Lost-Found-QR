import crypto from "crypto";
import { prisma } from "../../libs/prisma";
import { logger } from "../../libs/logger";
import { redis } from "../../libs/redis";
import { AppError } from "../../middlewares/error.middleware";
import { closeItemChannel } from "../../libs/stream-chat";
import { notificationService } from "../notification/notification.service";
import {
  emitReturnHandoverUpdated,
  emitReturnLocationCleared,
  emitReturnParticipantArrived,
  emitReturnRewardUpdated,
  emitReturnSessionUpdated,
} from "../../socket/return.socket";
import { emitLostItemRemovedToNearbyUsers } from "../../socket/radar.socket";
import {
  ConfirmHandoverRequest,
  DisputeHandoverRequest,
  FinderRating,
  HandoverDetails,
  HandoverInitResult,
  MeetupProposal,
  ProposeMeetupRequest,
  ReturnParticipant,
  ReturnSession,
  ReturnSessionStatus,
  ReturnUserRole,
  RewardPayout,
  SubmitRatingRequest,
} from "./return.types";
import {
  assertReturnAction,
  getReturnCapabilities,
  RETURN_TERMINAL_OR_PRIVATE_REVOKED_STATES,
} from "./return.policy";

const CODE_SALT = "lost_found_handover_salt_2026";
const HANDOVER_CODE_TTL_SECONDS = 300; // 5 minutes
const MAX_HANDOVER_ATTEMPTS = 5;

const VALID_TRANSITIONS: Record<ReturnSessionStatus, ReturnSessionStatus[]> = {
  CHAT_ACTIVE: ["MEETUP_PROPOSED", "HANDOVER_DISPUTED"],
  MEETUP_PROPOSED: [
    "MEETUP_ACCEPTED",
    "MEETUP_CANCELLED",
    "CHAT_ACTIVE",
    "HANDOVER_DISPUTED",
  ],
  MEETUP_ACCEPTED: [
    "TRACKING_ACTIVE",
    "ARRIVAL_PENDING",
    "HANDOVER_PENDING",
    "MEETUP_CANCELLED",
    "HANDOVER_DISPUTED",
  ],
  TRACKING_ACTIVE: [
    "ARRIVAL_PENDING",
    "HANDOVER_PENDING",
    "MEETUP_CANCELLED",
    "TRACKING_EXPIRED",
    "HANDOVER_DISPUTED",
  ],
  ARRIVAL_PENDING: [
    "HANDOVER_PENDING",
    "MEETUP_CANCELLED",
    "TRACKING_EXPIRED",
    "HANDOVER_DISPUTED",
  ],
  HANDOVER_PENDING: [
    "HANDOVER_CONFIRMED",
    "REWARD_RELEASING",
    "MEETUP_CANCELLED",
    "HANDOVER_DISPUTED",
  ],
  HANDOVER_CONFIRMED: ["REWARD_RELEASING", "REWARD_PAID", "HANDOVER_DISPUTED"],
  REWARD_RELEASING: ["REWARD_PAID", "PAYOUT_FAILED", "HANDOVER_DISPUTED"],
  REWARD_PAID: ["RATING_PENDING", "COMPLETED"],
  RATING_PENDING: ["COMPLETED"],
  COMPLETED: [],
  MEETUP_CANCELLED: ["MEETUP_PROPOSED", "CHAT_ACTIVE"],
  TRACKING_EXPIRED: ["MEETUP_PROPOSED", "HANDOVER_DISPUTED"],
  HANDOVER_DISPUTED: ["REFUND_PENDING", "COMPLETED"],
  PAYOUT_FAILED: ["REWARD_RELEASING", "REFUND_PENDING"],
  REFUND_PENDING: ["COMPLETED"],
};

export class ReturnService {
  private notifySafely(operation: Promise<unknown>, event: string): void {
    void operation.catch((error) => {
      logger.error(`[ReturnNotification] ${event} delivery failed`, error);
    });
  }

  private async clearLiveLocations(session: {
    id: string;
    ownerId: string;
    finderId: string;
    serverRevision?: number;
  }): Promise<void> {
    await Promise.all([
      redis.del(`return:loc:${session.id}:${session.ownerId}`),
      redis.del(`return:loc:${session.id}:${session.finderId}`),
    ]);
    emitReturnLocationCleared(session.id, session.serverRevision);
  }
  /**
   * Check if transition is valid according to the state machine
   */
  private assertValidTransition(
    current: ReturnSessionStatus,
    next: ReturnSessionStatus
  ): void {
    if (current === next) return;
    const allowed = VALID_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      throw new AppError(
        `Cannot transition return session from ${current} to ${next}`,
        409,
        true,
        "INVALID_RETURN_TRANSITION"
      );
    }
  }

  /**
   * Verify caller is a session participant and derive their role
   */
  private assertParticipant(
    session: { ownerId: string; finderId: string },
    userId: string
  ): ReturnUserRole {
    if (userId === session.ownerId) return "OWNER";
    if (userId === session.finderId) return "FINDER";
    throw new AppError(
      "You are not a participant in this return session",
      403,
      true,
      "FORBIDDEN"
    );
  }

  /**
   * Concurrency revision check
   */
  private assertRevision(
    session: { serverRevision: number },
    ifMatch?: number
  ): void {
    if (ifMatch != null && session.serverRevision !== ifMatch) {
      throw new AppError(
        `Revision conflict. Current revision is ${session.serverRevision}, but If-Match was ${ifMatch}`,
        409,
        true,
        "REVISION_CONFLICT"
      );
    }
  }

  private hashCode(code: string): string {
    return crypto
      .createHash("sha256")
      .update(`${code}:${CODE_SALT}`)
      .digest("hex");
  }

  /**
   * Format Prisma ReturnSession entity to client contract
   */
  private async formatSession(
    session: any,
    currentUserId?: string
  ): Promise<ReturnSession> {
    const proposals = [...(session.meetupProposals || [])].sort(
      (a: any, b: any) =>
        new Date(b.proposedAt).getTime() - new Date(a.proposedAt).getTime()
    );
    const pendingProposal = proposals.find(
      (proposal: any) => proposal.status === "PENDING"
    );
    const acceptedProposal = proposals.find(
      (proposal: any) => proposal.status === "ACCEPTED"
    );
    const status = session.status as ReturnSessionStatus;
    const capabilities = getReturnCapabilities({
      status,
      hasPendingMeetup: Boolean(pendingProposal),
      hasAcceptedMeetup: Boolean(acceptedProposal),
      trackingExpiresAt: session.trackingExpiresAt,
      hasHandoverConfirmation: Boolean(session.handoverConfirmations?.length),
    });
    const ownerArrived =
      session.arrivals?.some(
        (a: any) => a.participantId === session.ownerId || a.role === "OWNER"
      ) || false;
    const finderArrived =
      session.arrivals?.some(
        (a: any) => a.participantId === session.finderId || a.role === "FINDER"
      ) || false;

    const owner: ReturnParticipant = {
      id: session.owner?.id || session.ownerId,
      role: "OWNER",
      displayName: session.owner?.displayName || "Chủ đồ",
      photoURL: session.owner?.photoURL || null,
      phoneNumber: session.owner?.phoneNumber || null,
      isVerified: session.owner?.isVerified ?? true,
      trustScore: session.owner?.trustScore ?? 5.0,
      isArrived: ownerArrived,
      sharingLocation: capabilities.liveSharingAllowed,
    };

    const finder: ReturnParticipant = {
      id: session.finder?.id || session.finderId,
      role: "FINDER",
      displayName: session.finder?.displayName || "Người nhặt",
      photoURL: session.finder?.photoURL || null,
      phoneNumber: session.finder?.phoneNumber || null,
      isVerified: session.finder?.isVerified ?? false,
      trustScore: session.finder?.trustScore ?? 5.0,
      isArrived: finderArrived,
      sharingLocation: capabilities.liveSharingAllowed,
    };

    // Latest proposal
    let meetup: MeetupProposal | null = null;
    const visibleProposal = capabilities.canReviewMeetup
      ? pendingProposal
      : capabilities.directionsAllowed || capabilities.handoverAllowed
        ? acceptedProposal
        : null;
    if (
      visibleProposal &&
      !RETURN_TERMINAL_OR_PRIVATE_REVOKED_STATES.includes(status)
    ) {
      const latest = visibleProposal;
      const proposedByName =
        latest.proposedBy === session.ownerId
          ? owner.displayName
          : finder.displayName;

      const maySeePreciseDestination = latest.status === "ACCEPTED";
      meetup = {
        id: latest.id,
        proposedBy: latest.proposedBy,
        proposedByName,
        address: latest.address,
        name: latest.name || undefined,
        ...(maySeePreciseDestination
          ? { latitude: latest.latitude, longitude: latest.longitude }
          : {}),
        scheduledTime: latest.scheduledTime,
        notes: latest.notes || undefined,
        status: latest.status,
        proposedAt: new Date(latest.proposedAt).toISOString(),
      };
    }

    // Handover details
    let handover: HandoverDetails | null = null;
    const ownerConf = session.handoverConfirmations?.find(
      (c: any) => c.role === "OWNER"
    );
    const finderConf = session.handoverConfirmations?.find(
      (c: any) => c.role === "FINDER"
    );

    if (session.handoverChallenge || ownerConf || finderConf) {
      handover = {
        finderConfirmed: Boolean(finderConf),
        ownerConfirmed: Boolean(ownerConf),
        finderConfirmedAt: finderConf?.confirmedAt
          ? new Date(finderConf.confirmedAt).toISOString()
          : undefined,
        ownerConfirmedAt: ownerConf?.confirmedAt
          ? new Date(ownerConf.confirmedAt).toISOString()
          : undefined,
        disputeReason: session.disputeReason || undefined,
        disputedBy: session.disputedBy || undefined,
        disputedAt: session.disputedAt
          ? new Date(session.disputedAt).toISOString()
          : undefined,
      };
    }

    // Reward payout
    let reward: RewardPayout | null = null;
    if (session.rewardPayout) {
      const rp = session.rewardPayout;
      reward = {
        baseReward: rp.baseAmount,
        platformFee: rp.platformFee,
        netAmount: rp.netAmount,
        currency: rp.currency,
        payoutMethodMasked: rp.payoutMethodMasked || undefined,
        status: rp.status,
        transactionId: rp.transactionId || undefined,
        paidAt: rp.paidAt ? new Date(rp.paidAt).toISOString() : undefined,
        failureReason: rp.failureReason || undefined,
        estimatedArrival: "Trong vòng 5–15 phút",
      };
    }

    // Rating
    let rating: FinderRating | null = null;
    if (session.rating) {
      const r = session.rating;
      rating = {
        score: r.score,
        tags: r.tags || [],
        comment: r.comment || undefined,
        createdAt: new Date(r.createdAt).toISOString(),
      };
    }

    return {
      id: session.id,
      channelId: session.channelId,
      sourceType: session.itemId ? "ITEM" : "FOUND_REPORT",
      itemId: session.itemId || undefined,
      foundReportId: session.foundReportId || undefined,
      itemName:
        session.item?.name || session.foundReport?.name || "Món đồ thất lạc",
      itemCategory:
        session.item?.category || session.foundReport?.category || undefined,
      itemImageUrl:
        session.item?.imagePublicUrl ||
        session.foundReport?.imagePublicUrl ||
        null,
      rewardAmount: session.itemId ? session.report?.bountyAmount || 0 : 0,
      status: session.status,
      owner,
      finder,
      meetup,
      handover,
      reward,
      rating,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.updatedAt).toISOString(),
      serverRevision: session.serverRevision,
      trackingExpiresAt: session.trackingExpiresAt
        ? new Date(session.trackingExpiresAt).toISOString()
        : null,
      capabilities,
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * POST /v1/returns
   * Create or fetch active return session for a channel
   */
  async createOrGetSession(
    userId: string,
    input: { channelId: string; itemId?: string }
  ): Promise<ReturnSession> {
    const { channelId } = input;

    // 1. Check existing session
    const existing = await prisma.returnSession.findUnique({
      where: { channelId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (existing) {
      this.assertParticipant(existing, userId);
      return this.formatSession(existing, userId);
    }

    // 2. Parse channelId to determine itemId and finderId if possible
    // Convention: item_{itemId}_{finderId}
    let itemId = input.itemId;
    let finderId: string | null = null;

    if (channelId.startsWith("item_")) {
      const parts = channelId.slice(5).split("_");
      if (parts.length >= 2) {
        if (!itemId) itemId = parts[0];
        finderId = parts.slice(1).join("_");
      }
    }

    if (!itemId) {
      throw new AppError(
        "itemId is required to create a new return session",
        400
      );
    }

    // 3. Query item and owner
    const item = await prisma.item.findFirst({
      where: {
        OR: [{ id: itemId }, { itemId }],
      },
      include: { owner: true },
    });

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    const ownerId = item.ownerId;

    // If finderId is not in channel name, caller must be the finder
    if (!finderId) {
      if (userId === ownerId) {
        throw new AppError("Finder ID could not be identified", 400);
      }
      finderId = userId;
    }

    if (ownerId === finderId) {
      throw new AppError("Owner and Finder cannot be the same user", 400);
    }

    // Verify caller is either owner or finder
    if (userId !== ownerId && userId !== finderId) {
      throw new AppError("You are not a participant in this item channel", 403);
    }

    // Find active lost report for reward info
    const report = await prisma.post.findFirst({
      where: {
        itemId: item.id,
        status: { in: ["ACTIVE", "PENDING_PAYMENT", "FOUND"] },
      },
      orderBy: { createdAt: "desc" },
    });

    // 4. Create new ReturnSession
    const created = await prisma.returnSession.create({
      data: {
        channelId,
        itemId: item.id,
        reportId: report?.id ?? null,
        ownerId,
        finderId,
        status: "CHAT_ACTIVE",
        serverRevision: 1,
      },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    logger.info(
      `[ReturnService] Return session created: ${created.id} for channel ${channelId}`
    );
    const counterpartyId = userId === ownerId ? finderId : ownerId;
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: counterpartyId,
        type: "RETURN_SESSION_CREATED",
        title: "Đã tạo phiên trao trả",
        content: "Một phiên trao trả đồ đã được tạo.",
        sessionId: created.id,
        itemId: created.itemId || undefined,
        dedupeKey: `return-session-created:${created.id}:${counterpartyId}`,
      }),
      "return session created"
    );
    return this.formatSession(created, userId);
  }

  /**
   * GET /v1/returns/:id
   */
  async getSession(userId: string, sessionId: string): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) {
      throw new AppError("Return session not found", 404);
    }

    this.assertParticipant(session, userId);
    return this.formatSession(session, userId);
  }

  /**
   * POST /v1/returns/:id/meetup/propose
   */
  async proposeMeetup(
    userId: string,
    sessionId: string,
    req: ProposeMeetupRequest,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction("PROPOSE_MEETUP", session.status as ReturnSessionStatus);
    this.assertValidTransition(
      session.status as ReturnSessionStatus,
      "MEETUP_PROPOSED"
    );

    // Create proposal & update session
    const [proposal, updated] = await prisma.$transaction([
      prisma.returnMeetupProposal.create({
        data: {
          sessionId,
          proposedBy: userId,
          address: req.address,
          name: req.name ?? null,
          latitude: req.latitude,
          longitude: req.longitude,
          scheduledTime: req.scheduledTime,
          notes: req.notes ?? null,
          status: "PENDING",
        },
      }),
      prisma.returnSession.update({
        where: { id: sessionId },
        data: {
          status: "MEETUP_PROPOSED",
          serverRevision: { increment: 1 },
        },
        include: {
          owner: true,
          finder: true,
          item: true,
          foundReport: true,
          report: true,
          meetupProposals: true,
          arrivals: true,
          handoverChallenge: true,
          handoverConfirmations: true,
          rewardPayout: true,
          rating: true,
        },
      }),
    ]);

    const formatted = await this.formatSession(updated, userId);
    emitReturnSessionUpdated(sessionId, formatted);

    // Notify counterparty
    const counterpartyId =
      userId === session.ownerId ? session.finderId : session.ownerId;
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: counterpartyId,
        type: "MEETUP_PROPOSED",
        title: "Đề xuất điểm hẹn mới",
        content: `Đối tác đã đề xuất điểm hẹn: ${req.address}`,
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `meetup-proposed:${proposal.id}:${counterpartyId}`,
      }),
      "meetup proposed"
    );

    return formatted;
  }

  /**
   * POST /v1/returns/:id/meetup/accept
   */
  async acceptMeetup(
    userId: string,
    sessionId: string,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: { orderBy: { proposedAt: "desc" }, take: 1 },
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction("ACCEPT_MEETUP", session.status as ReturnSessionStatus);
    this.assertValidTransition(
      session.status as ReturnSessionStatus,
      "MEETUP_ACCEPTED"
    );

    const latestProposal = session.meetupProposals[0];
    if (!latestProposal || latestProposal.status !== "PENDING") {
      throw new AppError("No pending meetup proposal found to accept", 400);
    }

    // Only counterparty can accept (cannot accept own proposal)
    if (latestProposal.proposedBy === userId) {
      throw new AppError(
        "You cannot accept your own meetup proposal",
        400,
        true,
        "INVALID_ACTION"
      );
    }

    const [, updated] = await prisma.$transaction([
      prisma.returnMeetupProposal.update({
        where: { id: latestProposal.id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
      }),
      prisma.returnSession.update({
        where: { id: sessionId },
        data: {
          status: "MEETUP_ACCEPTED",
          serverRevision: { increment: 1 },
        },
        include: {
          owner: true,
          finder: true,
          item: true,
          foundReport: true,
          report: true,
          meetupProposals: true,
          arrivals: true,
          handoverChallenge: true,
          handoverConfirmations: true,
          rewardPayout: true,
          rating: true,
        },
      }),
    ]);

    const formatted = await this.formatSession(updated, userId);
    emitReturnSessionUpdated(sessionId, formatted);

    // Notify proposer
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: latestProposal.proposedBy,
        type: "MEETUP_ACCEPTED",
        title: "Điểm hẹn được chấp nhận",
        content: `Đối tác đã chấp nhận điểm hẹn tại ${latestProposal.address}`,
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `meetup-accepted:${latestProposal.id}:${latestProposal.proposedBy}`,
      }),
      "meetup accepted"
    );

    return formatted;
  }

  /**
   * POST /v1/returns/:id/meetup/reject
   */
  async rejectMeetup(
    userId: string,
    sessionId: string,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: { orderBy: { proposedAt: "desc" }, take: 1 },
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction("REJECT_MEETUP", session.status as ReturnSessionStatus);

    const latestProposal = session.meetupProposals[0];
    if (latestProposal && latestProposal.status === "PENDING") {
      const isProposer = latestProposal.proposedBy === userId;
      await prisma.returnMeetupProposal.update({
        where: { id: latestProposal.id },
        data: {
          status: isProposer ? "CANCELLED" : "REJECTED",
          respondedAt: new Date(),
        },
      });
    }

    const updated = await prisma.returnSession.update({
      where: { id: sessionId },
      data: {
        status: "CHAT_ACTIVE",
        serverRevision: { increment: 1 },
      },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    const formatted = await this.formatSession(updated, userId);
    emitReturnSessionUpdated(sessionId, formatted);
    const counterpartyId =
      userId === session.ownerId ? session.finderId : session.ownerId;
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: counterpartyId,
        type: "MEETUP_CANCELLED",
        title: "Phiên gặp mặt đã bị hủy",
        content: "Đối phương đã hủy phiên gặp mặt.",
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `meetup-cancelled:${latestProposal?.id || updated.serverRevision}:${counterpartyId}`,
      }),
      "meetup cancelled"
    );
    return formatted;
  }

  /**
   * POST /v1/returns/:id/tracking/start
   */
  async startTracking(
    userId: string,
    sessionId: string,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction("START_TRACKING", session.status as ReturnSessionStatus);

    const acceptedMeetup = session.meetupProposals.some(
      (proposal) => proposal.status === "ACCEPTED"
    );
    if (!acceptedMeetup) {
      throw new AppError(
        "An accepted meetup is required",
        409,
        true,
        "MEETUP_NOT_ACCEPTED"
      );
    }

    const currentStatus = session.status as ReturnSessionStatus;
    if (
      currentStatus !== "MEETUP_ACCEPTED" &&
      currentStatus !== "TRACKING_ACTIVE" &&
      currentStatus !== "ARRIVAL_PENDING"
    ) {
      this.assertValidTransition(currentStatus, "TRACKING_ACTIVE");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours

    const updated = await prisma.returnSession.update({
      where: { id: sessionId },
      data: {
        status:
          currentStatus === "ARRIVAL_PENDING"
            ? "ARRIVAL_PENDING"
            : "TRACKING_ACTIVE",
        trackingStartedAt: session.trackingStartedAt || now,
        trackingExpiresAt: expiresAt,
        serverRevision: { increment: 1 },
      },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    const formatted = await this.formatSession(updated, userId);
    emitReturnSessionUpdated(sessionId, formatted);
    return formatted;
  }

  /**
   * POST /v1/returns/:id/tracking/stop
   */
  async stopTracking(
    userId: string,
    sessionId: string,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);

    // Delete cached location from Redis
    await redis.del(`return:loc:${sessionId}:${userId}`);

    const formatted = await this.formatSession(session, userId);
    return formatted;
  }

  /** Cancel an accepted/in-progress meetup before irreversible handover work. */
  async cancelReturn(
    userId: string,
    sessionId: string,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });
    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction("CANCEL", session.status as ReturnSessionStatus);
    if (session.handoverConfirmations.length > 0) {
      throw new AppError(
        "A confirmed handover can no longer be cancelled",
        409,
        true,
        "INVALID_RETURN_TRANSITION"
      );
    }

    const acceptedProposal = session.meetupProposals.find(
      (proposal) => proposal.status === "ACCEPTED"
    );
    const updated = await prisma.$transaction(async (tx) => {
      if (acceptedProposal) {
        await tx.returnMeetupProposal.update({
          where: { id: acceptedProposal.id },
          data: { status: "CANCELLED", respondedAt: new Date() },
        });
      }
      return tx.returnSession.update({
        where: { id: sessionId },
        data: {
          status: "MEETUP_CANCELLED",
          trackingExpiresAt: null,
          serverRevision: { increment: 1 },
        },
        include: {
          owner: true,
          finder: true,
          item: true,
          foundReport: true,
          report: true,
          meetupProposals: true,
          arrivals: true,
          handoverChallenge: true,
          handoverConfirmations: true,
          rewardPayout: true,
          rating: true,
        },
      });
    });

    await this.clearLiveLocations(updated);
    const formatted = await this.formatSession(updated, userId);
    emitReturnSessionUpdated(sessionId, formatted);
    const counterpartyId =
      userId === session.ownerId ? session.finderId : session.ownerId;
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: counterpartyId,
        type: "MEETUP_CANCELLED",
        title: "Phiên gặp mặt đã bị hủy",
        content: "Đối phương đã hủy phiên gặp mặt.",
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `meetup-cancelled:${acceptedProposal?.id || updated.serverRevision}:${counterpartyId}`,
      }),
      "return cancelled"
    );
    return formatted;
  }

  /**
   * POST /v1/returns/:id/arrival
   */
  async notifyArrival(
    userId: string,
    sessionId: string,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    const role = this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction(
      "ARRIVE",
      session.status as ReturnSessionStatus,
      session.trackingExpiresAt
    );

    // Record arrival
    await prisma.returnArrival.upsert({
      where: {
        sessionId_participantId: {
          sessionId,
          participantId: userId,
        },
      },
      update: {
        declaredAt: new Date(),
        role,
      },
      create: {
        sessionId,
        participantId: userId,
        role,
      },
    });

    // Check if counterparty has arrived
    const counterpartyId =
      userId === session.ownerId ? session.finderId : session.ownerId;
    const counterpartyArrived = session.arrivals.some(
      (a) => a.participantId === counterpartyId
    );

    const nextStatus: ReturnSessionStatus = counterpartyArrived
      ? "HANDOVER_PENDING"
      : "ARRIVAL_PENDING";

    const updated = await prisma.returnSession.update({
      where: { id: sessionId },
      data: {
        status: nextStatus,
        serverRevision: { increment: 1 },
      },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    emitReturnParticipantArrived(sessionId, userId);
    const formatted = await this.formatSession(updated, userId);
    emitReturnSessionUpdated(sessionId, formatted);

    // Notify counterparty
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: counterpartyId,
        type: "PARTNER_ARRIVED",
        title: "Đối tác đã đến điểm hẹn!",
        content: `${role === "OWNER" ? "Chủ đồ" : "Người nhặt"} đã có mặt tại điểm hẹn.`,
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `participant-arrived:${sessionId}:${userId}:${counterpartyId}`,
      }),
      "participant arrived"
    );

    return formatted;
  }

  /**
   * POST /v1/returns/:id/handover/init
   * Generate secure 6-digit cryptographic PIN code with 5-minute TTL and max 5 attempts
   */
  async initHandover(
    userId: string,
    sessionId: string
  ): Promise<HandoverInitResult> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        arrivals: true,
        handoverConfirmations: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    const role = this.assertParticipant(session, userId);
    assertReturnAction("INIT_HANDOVER", session.status as ReturnSessionStatus);
    if (role !== "FINDER") {
      throw new AppError(
        "Only the finder can generate the handover code",
        403,
        true,
        "FORBIDDEN"
      );
    }

    // Generate 6-digit random code
    const codeNumber = crypto.randomInt(100000, 1000000); // 100000 to 999999
    const code = String(codeNumber);
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + HANDOVER_CODE_TTL_SECONDS * 1000);

    // Upsert HandoverChallenge in database (storing only codeHash)
    await prisma.handoverChallenge.upsert({
      where: { sessionId },
      update: {
        codeHash,
        expiresAt,
        attemptCount: 0,
        maxAttempts: MAX_HANDOVER_ATTEMPTS,
        consumedAt: null,
        createdForUserId: userId,
      },
      create: {
        sessionId,
        codeHash,
        expiresAt,
        attemptCount: 0,
        maxAttempts: MAX_HANDOVER_ATTEMPTS,
        createdForUserId: userId,
      },
    });

    // Cache plain code in Redis for creator retrieval during the 5-minute window
    await redis.set(
      `return:code:${sessionId}`,
      code,
      HANDOVER_CODE_TTL_SECONDS
    );

    // Update status to HANDOVER_PENDING if not already
    if (
      session.status !== "HANDOVER_PENDING" &&
      session.status !== "HANDOVER_CONFIRMED"
    ) {
      await prisma.returnSession.update({
        where: { id: sessionId },
        data: {
          status: "HANDOVER_PENDING",
          serverRevision: { increment: 1 },
        },
      });
    }

    const qrPayload = `handover://${sessionId}?code=${code}`;

    const ownerConf = session.handoverConfirmations?.find(
      (c) => c.role === "OWNER"
    );
    const finderConf = session.handoverConfirmations?.find(
      (c) => c.role === "FINDER"
    );

    const handoverDetails: HandoverInitResult = {
      code,
      qrPayload,
      ownerConfirmed: Boolean(ownerConf),
      finderConfirmed: Boolean(finderConf),
    };

    emitReturnHandoverUpdated(
      sessionId,
      {
        finderConfirmed: Boolean(finderConf),
        ownerConfirmed: Boolean(ownerConf),
      },
      "HANDOVER_PENDING"
    );
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: session.ownerId,
        type: "HANDOVER_READY",
        title: "Sẵn sàng bàn giao",
        content: "Phiên trao trả đã sẵn sàng để xác nhận bàn giao.",
        sessionId,
        dedupeKey: `handover-ready:${sessionId}:${session.ownerId}`,
      }),
      "handover ready"
    );
    return handoverDetails;
  }

  /**
   * POST /v1/returns/:id/handover/confirm
   * Confirm handover with atomic transaction & escrow release
   */
  async confirmHandover(
    userId: string,
    sessionId: string,
    req: ConfirmHandoverRequest,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: { include: { escrowTransactions: true } },
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    // Role is strictly derived from DB, client role is completely ignored
    const role = this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction(
      "CONFIRM_HANDOVER",
      session.status as ReturnSessionStatus
    );

    // Check if user has already confirmed
    const existingConfirmation = session.handoverConfirmations.find(
      (c) => c.participantId === userId
    );

    // The owner proves in-person possession with the finder-generated PIN.
    // The finder confirmation is direct and never consumes or echoes the PIN.
    if (role === "OWNER") {
      if (!req.code) {
        throw new AppError(
          "Handover code is required",
          400,
          true,
          "HANDOVER_CODE_REQUIRED"
        );
      }
      const challenge = session.handoverChallenge;
      if (!challenge) {
        throw new AppError("No active handover challenge found", 400);
      }

      if (challenge.consumedAt) {
        throw new AppError("Handover code has already been used", 400);
      }

      if (new Date(challenge.expiresAt).getTime() < Date.now()) {
        throw new AppError(
          "Handover code has expired. Please request a new code.",
          400,
          true,
          "HANDOVER_CODE_EXPIRED"
        );
      }

      if (challenge.attemptCount >= challenge.maxAttempts) {
        throw new AppError(
          "Maximum verification attempts exceeded.",
          400,
          true,
          "HANDOVER_CODE_LOCKED"
        );
      }

      const hashInput = this.hashCode(req.code.trim());
      if (hashInput !== challenge.codeHash) {
        await prisma.handoverChallenge.update({
          where: { id: challenge.id },
          data: { attemptCount: { increment: 1 } },
        });
        throw new AppError(
          "Invalid handover code",
          400,
          true,
          "INVALID_HANDOVER_CODE"
        );
      }

      // Mark challenge consumed
      await prisma.handoverChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
    }

    // Record confirmation if not already recorded
    if (!existingConfirmation) {
      await prisma.handoverConfirmation.create({
        data: {
          sessionId,
          participantId: userId,
          role,
          idempotencyKey: req.idempotencyKey ?? null,
          verificationMethod: req.code ? "CODE" : "DIRECT",
        },
      });
    }

    // Check if counterparty has confirmed
    const counterpartyId =
      userId === session.ownerId ? session.finderId : session.ownerId;
    const counterpartyConfirmed = session.handoverConfirmations.some(
      (c) => c.participantId === counterpartyId
    );

    // Case 1: Only 1 party confirmed so far
    if (!counterpartyConfirmed) {
      const updated = await prisma.returnSession.update({
        where: { id: sessionId },
        data: {
          status: "HANDOVER_PENDING",
          serverRevision: { increment: 1 },
        },
        include: {
          owner: true,
          finder: true,
          item: true,
          foundReport: true,
          report: true,
          meetupProposals: true,
          arrivals: true,
          handoverChallenge: true,
          handoverConfirmations: true,
          rewardPayout: true,
          rating: true,
        },
      });

      const formatted = await this.formatSession(updated, userId);
      if (formatted.handover) {
        emitReturnHandoverUpdated(
          sessionId,
          formatted.handover,
          "HANDOVER_PENDING"
        );
      }
      emitReturnSessionUpdated(sessionId, formatted);
      return formatted;
    }

    // Case 2: Both parties confirmed! Execute atomic transaction (P0)
    logger.info(
      `[ReturnService] Both parties confirmed for session ${sessionId}. Executing atomic resolution.`
    );

    const isItemSource = Boolean(session.itemId);
    const rewardAmount = isItemSource ? session.report?.bountyAmount || 0 : 0;
    const isGuestFinder =
      !session.finder.isVerified && !session.finder.phoneNumber;
    const payoutStatus = isGuestFinder ? "ACTION_REQUIRED" : "PAID";

    await prisma.$transaction(async (tx) => {
      // 1. Lock return session
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "return_sessions" WHERE "id" = $1 FOR UPDATE',
        sessionId
      );

      // 2. Lock the session while source-specific completion is applied.
      await tx.returnSession.update({
        where: { id: sessionId },
        data: {
          status: isItemSource ? "REWARD_RELEASING" : "HANDOVER_CONFIRMED",
          completedAt: new Date(),
          serverRevision: { increment: 1 },
        },
      });

      if (isItemSource) {
        if (!session.itemId) {
          throw new AppError(
            "Item source is missing",
            409,
            true,
            "INVALID_RETURN_SOURCE"
          );
        }
        const itemTransition = await tx.item.updateMany({
          where: { id: session.itemId, status: "FOUND" },
          data: { status: "RESOLVED" },
        });
        if (itemTransition.count !== 1) {
          throw new AppError(
            "Item must be FOUND before the handover can be resolved",
            409,
            true,
            "INVALID_ITEM_STATUS_TRANSITION"
          );
        }

        if (session.reportId) {
          await tx.post.update({
            where: { id: session.reportId },
            data: { status: "COMPLETED" },
          });
          const holdingEscrow = session.report?.escrowTransactions?.find(
            (t) => t.status === "HOLDING"
          );
          if (holdingEscrow) {
            await tx.escrowTransaction.update({
              where: { id: holdingEscrow.id },
              data: { status: "RELEASED" },
            });
          }
        }

        await tx.rewardPayoutRecord.upsert({
          where: { sessionId },
          update: {
            status: payoutStatus,
            paidAt: payoutStatus === "PAID" ? new Date() : null,
          },
          create: {
            sessionId,
            reportId: session.reportId,
            baseAmount: rewardAmount,
            netAmount: rewardAmount,
            platformFee: 0,
            currency: "VND",
            status: payoutStatus,
            transactionId: `TXN-${Date.now().toString().slice(-8)}`,
            payoutMethodMasked: isGuestFinder
              ? undefined
              : "Vietcombank •••• 5678",
            paidAt: payoutStatus === "PAID" ? new Date() : null,
          },
        });
      } else {
        if (!session.foundReportId) {
          throw new AppError(
            "Found report source is missing",
            409,
            true,
            "INVALID_RETURN_SOURCE"
          );
        }
        const resolved = await tx.foundReport.updateMany({
          where: { id: session.foundReportId, resolvedAt: null },
          data: { resolvedAt: new Date() },
        });
        if (resolved.count !== 1) {
          throw new AppError(
            "Found report is already resolved",
            409,
            true,
            "FOUND_REPORT_ALREADY_RESOLVED"
          );
        }
      }

      // 6. Update finder reputation
      await tx.user.update({
        where: { id: session.finderId },
        data: {
          totalReturned: { increment: 1 },
          trustScore: Math.min(5.0, (session.finder.trustScore || 5.0) + 0.1),
        },
      });

      // FoundReport has no reward/escrow model; both sources converge at rating.
      await tx.returnSession.update({
        where: { id: sessionId },
        data: {
          status: !isItemSource
            ? "RATING_PENDING"
            : payoutStatus === "PAID"
              ? "RATING_PENDING"
              : "HANDOVER_CONFIRMED",
        },
      });
    });

    // Close Stream chat channel
    try {
      await closeItemChannel(session.channelId);
    } catch (err) {
      logger.warn(
        `[ReturnService] Could not freeze stream channel ${session.channelId}:`,
        err
      );
    }

    // Reload updated session
    const resolvedSession = await prisma.returnSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    const formatted = await this.formatSession(resolvedSession, userId);
    await this.clearLiveLocations(resolvedSession);

    if (formatted.handover) {
      emitReturnHandoverUpdated(
        sessionId,
        formatted.handover,
        resolvedSession.status as ReturnSessionStatus
      );
    }
    if (formatted.reward) {
      emitReturnRewardUpdated(
        sessionId,
        formatted.reward,
        resolvedSession.status as ReturnSessionStatus
      );
    }
    emitReturnSessionUpdated(sessionId, formatted);

    if (resolvedSession.item) {
      const latitude = Number(
        resolvedSession.item.lostLat ?? resolvedSession.item.latitude
      );
      const longitude = Number(
        resolvedSession.item.lostLng ?? resolvedSession.item.longitude
      );
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        void emitLostItemRemovedToNearbyUsers({
          itemId: resolvedSession.item.itemId,
          latitude,
          longitude,
          status: "RESOLVED",
          removedAt: new Date().toISOString(),
        }).catch((err) => {
          logger.error(
            "Failed to emit radar removal on handover resolution",
            err
          );
        });
      }
    }

    // Send notifications to both participants
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: session.ownerId,
        type: "HANDOVER_CONFIRMED",
        title: "Bàn giao đồ thành công!",
        content: `Món đồ "${session.item?.name || session.foundReport?.name || "Đồ vật"}" đã được hoàn trả thành công. Vui lòng gửi đánh giá cho người nhặt.`,
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `handover-confirmed:${sessionId}:${session.ownerId}`,
      }),
      "handover confirmed owner"
    );

    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: session.finderId,
        type: isItemSource ? "REWARD_PAID" : "HANDOVER_CONFIRMED",
        title: isItemSource
          ? "Bàn giao thành công & Giải ngân thưởng!"
          : "Bàn giao thành công!",
        content: !isItemSource
          ? "Bàn giao thành công. Cảm ơn bạn đã giúp hoàn trả đồ vật."
          : isGuestFinder
            ? "Bàn giao thành công. Vui lòng liên kết tài khoản để nhận tiền thưởng."
            : `Bàn giao thành công. Phần thưởng ${rewardAmount.toLocaleString("vi-VN")} VND đang được chuyển.`,
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `handover-confirmed:${sessionId}:${session.finderId}`,
      }),
      "handover confirmed finder"
    );

    return formatted;
  }

  /**
   * POST /v1/returns/:id/handover/dispute
   */
  async disputeHandover(
    userId: string,
    sessionId: string,
    req: DisputeHandoverRequest,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction("DISPUTE", session.status as ReturnSessionStatus);

    const updated = await prisma.returnSession.update({
      where: { id: sessionId },
      data: {
        status: "HANDOVER_DISPUTED",
        serverRevision: { increment: 1 },
      },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    logger.warn(
      `[ReturnService] Return session ${sessionId} disputed by ${userId}: ${req.reason}`
    );

    await this.clearLiveLocations(updated);

    const formatted = await this.formatSession(updated, userId);
    formatted.handover = {
      ...(formatted.handover || {
        finderConfirmed: false,
        ownerConfirmed: false,
      }),
      disputeReason: req.reason,
      disputedBy: userId,
      disputedAt: new Date().toISOString(),
    };

    emitReturnSessionUpdated(sessionId, formatted);

    // Notify counterparty
    const counterpartyId =
      userId === session.ownerId ? session.finderId : session.ownerId;
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: counterpartyId,
        type: "HANDOVER_DISPUTED",
        title: "Tranh chấp bàn giao",
        content: `Phiên bàn giao đã bị khiếu nại: "${req.reason}". Đội ngũ hỗ trợ sẽ can thiệp.`,
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `handover-disputed:${sessionId}:${updated.serverRevision}:${counterpartyId}`,
      }),
      "handover disputed"
    );

    return formatted;
  }

  /**
   * GET /v1/returns/:id/reward
   */
  async getRewardStatus(
    userId: string,
    sessionId: string
  ): Promise<RewardPayout> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        rewardPayout: true,
        report: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);

    if (!session.itemId) {
      throw new AppError(
        "Found-report returns do not have a reward payout",
        409,
        true,
        "REWARD_NOT_APPLICABLE"
      );
    }

    if (session.rewardPayout) {
      const rp = session.rewardPayout;
      return {
        baseReward: rp.baseAmount,
        platformFee: rp.platformFee,
        netAmount: rp.netAmount,
        currency: rp.currency,
        payoutMethodMasked: rp.payoutMethodMasked || undefined,
        status: rp.status,
        transactionId: rp.transactionId || undefined,
        paidAt: rp.paidAt ? new Date(rp.paidAt).toISOString() : undefined,
        failureReason: rp.failureReason || undefined,
        estimatedArrival: "Trong vòng 5–15 phút",
      };
    }

    const defaultAmount = session.report?.bountyAmount || 0;
    return {
      baseReward: defaultAmount,
      platformFee: 0,
      netAmount: defaultAmount,
      currency: "VND",
      status: "PROCESSING",
    };
  }

  /**
   * POST /v1/returns/:id/rating
   * Only owner can submit rating for finder, exactly once
   */
  async submitRating(
    userId: string,
    sessionId: string,
    req: SubmitRatingRequest,
    ifMatch?: number
  ): Promise<ReturnSession> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: {
        owner: true,
        finder: true,
        item: true,
        foundReport: true,
        report: true,
        meetupProposals: true,
        arrivals: true,
        handoverChallenge: true,
        handoverConfirmations: true,
        rewardPayout: true,
        rating: true,
      },
    });

    if (!session) throw new AppError("Return session not found", 404);
    this.assertParticipant(session, userId);
    this.assertRevision(session, ifMatch);
    assertReturnAction("RATE", session.status as ReturnSessionStatus);

    // P0: ONLY owner can rate finder
    if (userId !== session.ownerId) {
      throw new AppError(
        "Only the owner can submit a rating for the finder",
        403,
        true,
        "ONLY_OWNER_CAN_RATE"
      );
    }

    // Check if already rated
    const existingRating = await prisma.finderRatingRecord.findUnique({
      where: { sessionId },
    });
    if (existingRating) {
      throw new AppError(
        "A rating has already been submitted for this session",
        409,
        true,
        "ALREADY_RATED"
      );
    }

    // Create rating record and complete session
    const [, updated] = await prisma.$transaction([
      prisma.finderRatingRecord.create({
        data: {
          sessionId,
          raterId: userId,
          finderId: session.finderId,
          score: req.score,
          tags: req.tags || [],
          comment: req.comment ?? null,
        },
      }),
      prisma.returnSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          serverRevision: { increment: 1 },
        },
        include: {
          owner: true,
          finder: true,
          item: true,
          foundReport: true,
          report: true,
          meetupProposals: true,
          arrivals: true,
          handoverChallenge: true,
          handoverConfirmations: true,
          rewardPayout: true,
          rating: true,
        },
      }),
      // Re-calculate finder trust score based on ratings
      prisma.user.update({
        where: { id: session.finderId },
        data: {
          trustScore: Math.min(
            5.0,
            Math.max(1.0, (session.finder.trustScore * 4 + req.score) / 5)
          ),
        },
      }),
    ]);

    const formatted = await this.formatSession(updated, userId);
    await this.clearLiveLocations(updated);
    emitReturnSessionUpdated(sessionId, formatted);

    // Notify finder
    this.notifySafely(
      notificationService.notifyReturnEvent({
        receiverId: session.finderId,
        type: "RATING_RECEIVED",
        title: "Bạn vừa nhận được đánh giá mới!",
        content: `Chủ đồ đã gửi đánh giá ${req.score} sao cho bạn. Cảm ơn sự giúp đỡ của bạn!`,
        sessionId,
        itemId: session.itemId || undefined,
        dedupeKey: `rating-received:${sessionId}:${session.finderId}`,
      }),
      "rating received"
    );

    return formatted;
  }
}

export const returnService = new ReturnService();
