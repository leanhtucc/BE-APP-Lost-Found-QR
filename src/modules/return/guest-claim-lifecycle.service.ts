import { ENV } from "../../config/env";
import { logger } from "../../libs/logger";
import {
  closeItemChannel,
  getItemChannelLastMessageAt,
} from "../../libs/stream-chat";
import { prisma } from "../../libs/prisma";
import { AppError } from "../../middlewares/error.middleware";

type GuestClaimSession = {
  id: string;
  channelId: string;
  ownerId: string;
  finderId: string;
  itemId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  finder: { role: string };
};

export class GuestClaimLifecycleService {
  private async cancelSession(
    session: GuestClaimSession,
    ownerId?: string
  ): Promise<boolean> {
    if (ownerId && session.ownerId !== ownerId) {
      throw new AppError(
        "Only the item owner can reject this guest claim",
        403,
        true,
        "RETURN_FORBIDDEN"
      );
    }
    if (session.finder.role !== "guest") {
      throw new AppError(
        "Return session is not a guest claim",
        409,
        true,
        "NOT_GUEST_CLAIM"
      );
    }
    if (session.status === "MEETUP_CANCELLED") {
      await this.closeChannel(session.channelId);
      return false;
    }
    if (session.status !== "CHAT_ACTIVE") {
      throw new AppError(
        "Guest claim is no longer active",
        409,
        true,
        "CLAIM_NOT_ACTIVE"
      );
    }

    // Freeze first. If Stream is unavailable, leave the DB claim active so the
    // owner or the next job run can retry without invalidating the guest token.
    await this.closeChannel(session.channelId);

    const cancelled = await prisma.$transaction(async (tx) => {
      const transition = await tx.returnSession.updateMany({
        where: { id: session.id, status: "CHAT_ACTIVE" },
        data: {
          status: "MEETUP_CANCELLED",
          trackingExpiresAt: null,
          serverRevision: { increment: 1 },
        },
      });
      if (transition.count !== 1) return false;

      if (session.itemId) {
        const itemTransition = await tx.item.updateMany({
          where: { id: session.itemId, status: { in: ["FOUND", "LOST"] } },
          data: { status: "LOST" },
        });
        if (itemTransition.count !== 1) {
          throw new AppError(
            "Claimed item cannot be returned to LOST",
            409,
            true,
            "INVALID_ITEM_STATUS_TRANSITION"
          );
        }
        await tx.post.updateMany({
          where: { itemId: session.itemId, status: "FOUND" },
          data: { status: "ACTIVE" },
        });
      }
      return true;
    });

    if (cancelled) return true;
    const current = await prisma.returnSession.findUnique({
      where: { id: session.id },
      select: { status: true },
    });
    if (current?.status === "MEETUP_CANCELLED") return false;
    throw new AppError(
      "Guest claim changed before it could be cancelled",
      409,
      true,
      "CLAIM_STATE_CONFLICT"
    );
  }

  private async closeChannel(channelId: string): Promise<void> {
    try {
      await closeItemChannel(channelId);
    } catch (error) {
      logger.error("Failed to freeze guest claim channel", error);
      throw new AppError(
        "Guest chat is temporarily unavailable. Retry the cancellation.",
        503,
        true,
        "STREAM_CHANNEL_CLOSE_FAILED"
      );
    }
  }

  async rejectByOwner(ownerId: string, sessionId: string): Promise<void> {
    const session = await prisma.returnSession.findUnique({
      where: { id: sessionId },
      include: { finder: { select: { role: true } } },
    });
    if (!session) throw new AppError("Return session not found", 404);
    await this.cancelSession(session as GuestClaimSession, ownerId);
  }

  async expireAbandonedGuestClaims(now = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - ENV.GUEST_CLAIM_INACTIVE_HOURS * 60 * 60 * 1000
    );
    const candidates = await prisma.returnSession.findMany({
      where: { status: "CHAT_ACTIVE", updatedAt: { lte: cutoff } },
      include: { finder: { select: { role: true } } },
      orderBy: { updatedAt: "asc" },
      take: 100,
    });
    let expiredCount = 0;

    for (const candidate of candidates) {
      const session = candidate as GuestClaimSession;
      if (session.finder.role !== "guest") continue;
      let lastMessageAt: Date | null;
      try {
        lastMessageAt = await getItemChannelLastMessageAt(session.channelId);
      } catch (error) {
        logger.warn(
          `[GuestClaimExpiry] Skipping ${session.id}; Stream activity lookup failed`,
          error
        );
        continue;
      }
      const lastActivity = Math.max(
        session.createdAt.getTime(),
        session.updatedAt.getTime(),
        lastMessageAt?.getTime() ?? 0
      );
      if (lastActivity > cutoff.getTime()) continue;

      try {
        if (await this.cancelSession(session)) expiredCount += 1;
      } catch (error) {
        logger.error(
          `[GuestClaimExpiry] Failed to expire ${session.id}`,
          error
        );
      }
    }
    return expiredCount;
  }
}

export const guestClaimLifecycleService = new GuestClaimLifecycleService();
