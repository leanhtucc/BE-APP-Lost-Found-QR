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

const SYSTEM_FEE_PERCENTAGE = 0.1; // 10% fee

export class ReportService {
  private parseItemChannelId(channelId: string): {
    itemId: string;
    finderId: string;
  } | null {
    if (!channelId.startsWith("item_")) {
      return null;
    }

    const parts = channelId.split("_");
    if (parts.length < 3) {
      return null;
    }

    const itemId = parts[1] || "";
    const finderId = parts.slice(2).join("_");

    if (!itemId || !finderId) {
      return null;
    }

    return {
      itemId,
      finderId,
    };
  }

  /**
   * Bước 4 (Tạo Report):
   * Create Post, Transaction, and mock payment URL
   */
  async createLostReport(
    userId: string,
    params: ReportLostItemParams
  ): Promise<ReportLostItemResponse> {
    const { itemId, location, bounty, paymentMethod } = params;

    // Verify item ownership and status
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new Error("Item not found");
    }
    if (item.ownerId !== userId) {
      throw new Error("You do not own this item");
    }

    // Calculate total amount (Bounty + System Fee)
    const systemFee = Math.round(bounty * SYSTEM_FEE_PERCENTAGE);
    const totalAmount = bounty + systemFee;

    // Create Post + EscrowTransaction inside a DB transaction
    const post = await prisma.$transaction(async (tx: any) => {
      const newPost = await tx.post.create({
        data: {
          ownerId: userId,
          itemId,
          lat: location.lat,
          lng: location.lng,
          address: location.address,
          bountyAmount: bounty,
          status: "PENDING_PAYMENT",
          description: `Báo mất ${item.name}`,
        },
      });

      await tx.escrowTransaction.create({
        data: {
          postId: newPost.id,
          amount: totalAmount,
          provider: paymentMethod, // VNPAY, MOMO
          status: "HOLDING",
        },
      });

      await tx.item.update({
        where: { id: itemId },
        data: { status: "PENDING_PAYMENT" },
      });

      return newPost;
    });

    // Generate mock payment URL
    const mockPaymentUrl = `https://vnpay-sandbox.com/mock-pay?order_id=${post.id}&amount=${totalAmount}`;

    return {
      postId: post.id,
      paymentUrl: mockPaymentUrl,
      message: "Vui lòng hoàn tất thanh toán để kích hoạt Radar tìm kiếm.",
    };
  }

  /**
   * Xử lý Webhook (Quan trọng nhất):
   * Confirm payment -> set ACTIVE -> broadcast push notification
   */
  async handlePaymentWebhook(payload: WebhookPaymentPayload): Promise<void> {
    const { postId, amount, status, provider, transactionCode } = payload;

    if (status !== "success") {
      throw new Error("Payment failed or cancelled");
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        escrowTransactions: true,
        item: true,
      },
    });

    if (!post) throw new Error("Post not found");
    if (post.status === "ACTIVE") return; // Already processed

    const holdingTx = post.escrowTransactions.find(
      (tx) => tx.status === "HOLDING"
    );
    if (!holdingTx || holdingTx.amount !== amount) {
      throw new Error("Invalid transaction amount or state");
    }

    // 1. Mark as ACTIVE
    // Update the Post and Transaction statuses. We also update the item's lost coordinates.
    await prisma.$transaction([
      prisma.post.update({
        where: { id: postId },
        data: { status: "ACTIVE" },
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

    // 2. Create transaction notification for owner (escrow locked)
    await notificationService.notifyEscrowLocked({
      receiverId: post.ownerId,
      amount,
      transactionId: transactionCode || holdingTx.id,
      postId,
    });

    // 3. Broadcast via FCM to nearby users (5km radius)
    await this.broadcastToNearbyUsers(post.lat, post.lng, post.item.name);
  }

  async cancelEscrowForItem(
    ownerId: string,
    itemId: string
  ): Promise<CancelTransactionResult | null> {
    const post = await prisma.post.findFirst({
      where: {
        ownerId,
        itemId,
        status: {
          in: ["PENDING_PAYMENT", "ACTIVE"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        escrowTransactions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!post) {
      return null;
    }

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
        data: {
          status: "SAFE",
          lostLat: null,
          lostLng: null,
          lostAddress: null,
        },
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
      metadata: {
        post_id: post.id,
        item_id: itemId,
      },
    });

    return {
      postId: post.id,
      postStatus: "CANCELLED",
      transactionStatus: holdingTx ? "REFUNDED" : null,
      refundedAmount: holdingTx?.amount || 0,
    };
  }

  async completeEscrowFromChannel(
    ownerId: string,
    channelId: string
  ): Promise<CompleteTransactionResult | null> {
    const parsed = this.parseItemChannelId(channelId);

    if (!parsed) {
      return null;
    }

    const { itemId, finderId } = parsed;

    const post = await prisma.post.findFirst({
      where: {
        itemId,
        status: {
          in: ["PENDING_PAYMENT", "ACTIVE", "RESOLVED"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        escrowTransactions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!post) {
      return null;
    }

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
      await tx.post.update({
        where: { id: post.id },
        data: { status: "RESOLVED" },
      });

      if (holdingTx) {
        await tx.escrowTransaction.update({
          where: { id: holdingTx.id },
          data: { status: "RELEASED" },
        });
      }

      await tx.item.update({
        where: { id: itemId },
        data: {
          status: "RESOLVED",
        },
      });
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
          holdingTx?.transactionCode ||
          holdingTx?.id ||
          alreadyReleasedTx?.transactionCode ||
          alreadyReleasedTx?.id ||
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
      metadata: {
        post_id: post.id,
        item_id: itemId,
        finder_id: finderId,
      },
    });

    return {
      postId: post.id,
      postStatus: "RESOLVED",
      transactionStatus: holdingTx || alreadyReleasedTx ? "RELEASED" : null,
      releasedAmount: post.bountyAmount,
      finderId,
    };
  }

  private async broadcastToNearbyUsers(
    lat: number,
    lng: number,
    itemName: string
  ) {
    if (!admin.apps.length) {
      console.warn(
        "Firebase Admin SDK is mock/undefined. Skipping FCM broadcast."
      );
      return;
    }

    const earthRadius = 6371000;
    const radiusMeters = 5000;

    const sql = `
      SELECT u."pushToken"
      FROM "UserLocation" ul
      JOIN "User" u ON u.id = ul.user_id
      WHERE u."pushToken" IS NOT NULL
        AND ul."updatedAt" >= NOW() - INTERVAL '1 hour'
        AND ${earthRadius} * acos(
          LEAST(1.0, cos(radians($1)) * cos(radians(ul."lat")) *
          cos(radians(ul."lng") - radians($2)) +
          sin(radians($1)) * sin(radians(ul."lat")))
        ) <= $3
    `;

    const nearbyUsers = await prisma.$queryRawUnsafe<{ pushToken: string }[]>(
      sql,
      lat,
      lng,
      radiusMeters
    );

    const tokens = nearbyUsers.map((u) => u.pushToken).filter(Boolean);

    if (tokens.length === 0) {
      console.log("No nearby active users found for FCM broadcast.");
      return;
    }

    const message = {
      notification: {
        title: "Radar Khẩn Cấp 🚨",
        body: `Có người vừa thất lạc ${itemName} gần bạn (5km). Chú ý giúp đỡ nhé!`,
      },
      tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `Successfully broadcasted radar alert to ${response.successCount} users.`
      );
    } catch (error) {
      console.error("Error sending FCM multicast message:", error);
    }
  }
}

export const reportService = new ReportService();
