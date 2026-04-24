import admin from "../../config/firebaseAdmin";
import { logger } from "../../libs/logger";
import { prisma } from "../../libs/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { notificationService } from "../notification/notification.service";
import {
  CancelTransactionResult,
  CompleteTransactionResult,
  ReportLostItemParams,
  ReportLostItemResponse,
  WebhookPaymentPayload,
} from "./report.types";

const SYSTEM_FEE_PERCENTAGE = 0.1; // 10% platform fee
const EARTH_RADIUS_METERS = 6371000;

export class ReportService {
  // ─── Helpers ──────────────────────────────────────────────────────────────

  private parseItemChannelId(channelId: string): {
    itemId: string;
    finderId: string;
  } | null {
    if (!channelId.startsWith("item_")) return null;
    const parts = channelId.split("_");
    if (parts.length < 3) return null;
    const itemId = parts[1] || "";
    const finderId = parts.slice(2).join("_");
    if (!itemId || !finderId) return null;
    return { itemId, finderId };
  }

  /**
   * Count active users within a given radius using Haversine SQL.
   * Shared by both Radar simulate and FCM broadcast.
   */
  async countNearbyActiveUsers(
    lat: number,
    lng: number,
    radiusMeters: number
  ): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `
      SELECT COUNT(*)::bigint AS count
      FROM "UserLocation" ul
      WHERE ul."updatedAt" >= NOW() - INTERVAL '1 hour'
        AND ${EARTH_RADIUS_METERS} * acos(
          LEAST(1.0,
            cos(radians($1)) * cos(radians(ul."lat")) *
            cos(radians(ul."lng") - radians($2)) +
            sin(radians($1)) * sin(radians(ul."lat"))
          )
        ) <= $3
      `,
      lat,
      lng,
      radiusMeters
    );
    return Number(rows[0]?.count ?? 0);
  }

  // ─── 1. Create Lost Report (POST /v1/reports) ─────────────────────────────

  async createLostReport(
    userId: string,
    params: ReportLostItemParams
  ): Promise<ReportLostItemResponse> {
    const { itemId, location, radar, reward } = params;

    // Verify item ownership and eligibility
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError("Item not found", 404);
    if (item.ownerId !== userId) throw new AppError("You do not own this item", 403);
    if (item.status !== "SAFE") {
      throw new AppError(
        `Item cannot be reported: current status is ${item.status}`,
        409
      );
    }

    // Calculate total (bounty + 10% fee)
    const systemFee = Math.round(reward.baseAmount * SYSTEM_FEE_PERCENTAGE);
    const totalToPay = reward.baseAmount + systemFee;

    // DB transaction: Post + EscrowTransaction + Item status
    const post = await prisma.$transaction(async (tx: any) => {
      const newPost = await tx.post.create({
        data: {
          ownerId: userId,
          itemId,
          lat: location.lat,
          lng: location.lng,
          address: location.address,
          bountyAmount: reward.baseAmount,
          status: "PENDING_PAYMENT",
          description: `Báo mất ${item.name}`,
          radarRadius: radar.radius,
          durationHours: radar.durationHours,
        },
      });

      await tx.escrowTransaction.create({
        data: {
          postId: newPost.id,
          amount: totalToPay,
          provider: "VNPAY", // default; FE can override via webhook
          status: "HOLDING",
        },
      });

      await tx.item.update({
        where: { id: itemId },
        data: { status: "PENDING_PAYMENT" },
      });

      return newPost;
    });

    const paymentUrl = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?order_id=${post.id}&amount=${totalToPay}`;

    return {
      report_id: post.id,
      status: "PENDING_PAYMENT",
      payment: {
        total_to_pay: totalToPay,
        payment_url: paymentUrl,
      },
    };
  }

  // ─── 2. Payment Webhook ───────────────────────────────────────────────────

  /**
   * Called by VNPay/MoMo webhook when payment succeeds.
   * Transitions: PENDING_PAYMENT → SEARCHING
   * Side effects: escrow locked notification + FCM broadcast to nearby users.
   */
  async handlePaymentWebhook(payload: WebhookPaymentPayload): Promise<void> {
    const { postId, amount, status, transactionCode } = payload;

    if (status !== "success") {
      throw new AppError("Payment failed or cancelled", 400);
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { escrowTransactions: true, item: true },
    });

    if (!post) throw new AppError("Post not found", 404);
    if (post.status === "SEARCHING") return; // Idempotent

    const holdingTx = post.escrowTransactions.find(
      (tx) => tx.status === "HOLDING"
    );
    if (!holdingTx || holdingTx.amount !== amount) {
      throw new AppError("Invalid transaction amount or state", 400);
    }

    // Atomic state transition
    await prisma.$transaction([
      prisma.post.update({
        where: { id: postId },
        data: { status: "SEARCHING" },
      }),
      prisma.escrowTransaction.update({
        where: { id: holdingTx.id },
        data: { status: "HOLDING", transactionCode },
      }),
      prisma.item.update({
        where: { id: post.itemId },
        data: {
          status: "LOST",
          lostLat: post.lat,
          lostLng: post.lng,
          lostAddress: post.address,
        },
      }),
    ]);

    // Notify owner that escrow is locked
    await notificationService.notifyEscrowLocked({
      receiverId: post.ownerId,
      amount,
      transactionId: transactionCode || holdingTx.id,
      postId,
    });

    // FCM broadcast to nearby users within the chosen radar radius (or 5 km fallback)
    const radiusMeters = post.radarRadius ?? 5000;
    await this.broadcastToNearbyUsers(
      post.lat,
      post.lng,
      post.item.name,
      radiusMeters
    );
  }

  // ─── 3. Cancel Escrow ─────────────────────────────────────────────────────

  async cancelEscrowForItem(
    ownerId: string,
    itemId: string
  ): Promise<CancelTransactionResult | null> {
    const post = await prisma.post.findFirst({
      where: {
        ownerId,
        itemId,
        status: { in: ["PENDING_PAYMENT", "SEARCHING"] },
      },
      orderBy: { createdAt: "desc" },
      include: { escrowTransactions: { orderBy: { createdAt: "desc" } } },
    });

    if (!post) return null;

    const holdingTx = post.escrowTransactions.find(
      (tx) => tx.status === "HOLDING"
    );

    await prisma.$transaction(async (tx: any) => {
      await tx.post.update({
        where: { id: post.id },
        data: { status: "CANCELLED" },
      });

      if (holdingTx) {
        await tx.escrowTransaction.update({
          where: { id: holdingTx.id },
          data: { status: "REFUNDED" },
        });
      }

      await tx.item.update({
        where: { id: itemId },
        data: { status: "SAFE", lostLat: null, lostLng: null, lostAddress: null },
      });
    });

    if (holdingTx) {
      await notificationService.notifyPaymentRefunded({
        receiverId: ownerId,
        amount: holdingTx.amount,
        transactionId: holdingTx.transactionCode || holdingTx.id,
        status: "refunded",
        postId: post.id,
      });
    }

    await notificationService.notifyStatusUpdate({
      receiverId: ownerId,
      category: "ITEM",
      type: "STATUS_UPDATE",
      title: "Đã hủy giao dịch",
      content: "Bài đăng thất lạc đã được hủy và giao dịch được hoàn về ví.",
      metadata: { post_id: post.id, item_id: itemId },
    });

    return {
      postId: post.id,
      postStatus: "CANCELLED",
      transactionStatus: holdingTx ? "REFUNDED" : null,
      refundedAmount: holdingTx?.amount ?? 0,
    };
  }

  // ─── 4. Complete Escrow (Finder confirmed) ────────────────────────────────

  async completeEscrowFromChannel(
    ownerId: string,
    channelId: string
  ): Promise<CompleteTransactionResult | null> {
    const parsed = this.parseItemChannelId(channelId);
    if (!parsed) return null;

    const { itemId, finderId } = parsed;

    const post = await prisma.post.findFirst({
      where: {
        itemId,
        status: { in: ["PENDING_PAYMENT", "SEARCHING", "RESOLVED"] },
      },
      orderBy: { createdAt: "desc" },
      include: { escrowTransactions: { orderBy: { createdAt: "desc" } } },
    });

    if (!post) return null;
    if (post.ownerId !== ownerId) {
      throw new AppError("Only item owner can complete settlement", 403);
    }

    const alreadyReleasedTx = post.escrowTransactions.find(
      (tx) => tx.status === "RELEASED"
    );

    if (post.status === "RESOLVED" && alreadyReleasedTx) {
      return {
        postId: post.id,
        postStatus: "RESOLVED",
        transactionStatus: "RELEASED",
        releasedAmount: post.bountyAmount,
        finderId,
      };
    }

    const holdingTx = post.escrowTransactions.find(
      (tx) => tx.status === "HOLDING"
    );

    await prisma.$transaction(async (tx: any) => {
      await tx.post.update({ where: { id: post.id }, data: { status: "RESOLVED" } });
      if (holdingTx) {
        await tx.escrowTransaction.update({
          where: { id: holdingTx.id },
          data: { status: "RELEASED" },
        });
      }
      await tx.item.update({ where: { id: itemId }, data: { status: "RESOLVED" } });
    });

    const finder = await prisma.user.findUnique({
      where: { id: finderId },
      select: { id: true },
    });

    if (finder) {
      await notificationService.notifyBountyReleased({
        receiverId: finderId,
        amount: post.bountyAmount,
        transactionId:
          holdingTx?.transactionCode ??
          holdingTx?.id ??
          alreadyReleasedTx?.transactionCode ??
          alreadyReleasedTx?.id ??
          post.id,
        status: "released",
        postId: post.id,
      });
    } else {
      logger.warn("Finder user not found for released notification", {
        postId: post.id,
        finderId,
      });
    }

    await notificationService.notifyStatusUpdate({
      receiverId: ownerId,
      category: "ITEM",
      type: "STATUS_UPDATE",
      title: "Giao dịch đã hoàn tất",
      content: "Tiền thưởng đã được chuyển cho người nhặt thành công.",
      metadata: { post_id: post.id, item_id: itemId, finder_id: finderId },
    });

    return {
      postId: post.id,
      postStatus: "RESOLVED",
      transactionStatus: holdingTx || alreadyReleasedTx ? "RELEASED" : null,
      releasedAmount: post.bountyAmount,
      finderId,
    };
  }

  // ─── 5. FCM Broadcast ─────────────────────────────────────────────────────

  private async broadcastToNearbyUsers(
    lat: number,
    lng: number,
    itemName: string,
    radiusMeters: number
  ): Promise<void> {
    if (!admin.apps.length) {
      logger.warn("Firebase Admin SDK not initialised – skipping FCM broadcast");
      return;
    }

    const nearbyUsers = await prisma.$queryRawUnsafe<{ pushToken: string }[]>(
      `
      SELECT u."pushToken"
      FROM "UserLocation" ul
      JOIN "User" u ON u.id = ul."user_id"
      WHERE u."pushToken" IS NOT NULL
        AND ul."updatedAt" >= NOW() - INTERVAL '1 hour'
        AND ${EARTH_RADIUS_METERS} * acos(
          LEAST(1.0,
            cos(radians($1)) * cos(radians(ul."lat")) *
            cos(radians(ul."lng") - radians($2)) +
            sin(radians($1)) * sin(radians(ul."lat"))
          )
        ) <= $3
      `,
      lat,
      lng,
      radiusMeters
    );

    const tokens = nearbyUsers.map((u) => u.pushToken).filter(Boolean);
    if (tokens.length === 0) {
      logger.info("No nearby active users found for FCM broadcast");
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        notification: {
          title: "Cảnh báo Guardian 🚨",
          body: `Có ${itemName} vừa rơi gần bạn (${radiusMeters / 1000}km). Tìm thấy nhận thưởng ngay!`,
        },
        tokens,
      });
      logger.info(`FCM broadcast sent to ${response.successCount} users`);
    } catch (error) {
      logger.error("FCM multicast error:", error);
    }
  }
}

export const reportService = new ReportService();
