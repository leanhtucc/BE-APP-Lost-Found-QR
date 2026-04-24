import cron, { ScheduledTask } from "node-cron";
import { logger } from "../libs/logger";
import { prisma } from "../libs/prisma";
import { notificationService } from "../modules/notification/notification.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Guardian Refund Job
 * Runs every day at midnight (00:00 server time).
 * Finds SEARCHING posts older than 30 days and triggers automatic refund.
 */
async function runRefundJob(): Promise<void> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const expiredPosts = await prisma.post.findMany({
    where: {
      status: "SEARCHING",
      createdAt: { lte: cutoff },
    },
    include: {
      escrowTransactions: {
        where: { status: "HOLDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (expiredPosts.length === 0) {
    logger.info("[RefundJob] No expired Guardian posts found");
    return;
  }

  logger.info(`[RefundJob] Processing ${expiredPosts.length} expired post(s)`);

  for (const post of expiredPosts) {
    try {
      const holdingTx = post.escrowTransactions[0];

      await prisma.$transaction(async (tx: any) => {
        await tx.post.update({
          where: { id: post.id },
          data: { status: "EXPIRED_REFUNDED" },
        });

        if (holdingTx) {
          await tx.escrowTransaction.update({
            where: { id: holdingTx.id },
            data: { status: "REFUNDED" },
          });
        }

        await tx.item.update({
          where: { id: post.itemId },
          data: {
            status: "SAFE",
            lostLat: null,
            lostLng: null,
            lostAddress: null,
          },
        });
      });

      // Notify owner of automatic refund
      await notificationService.notifyStatusUpdate({
        receiverId: post.ownerId,
        category: "TRANSACTION",
        type: "GUARDIAN_EXPIRED_REFUND",
        title: "Tin tìm đồ đã hết hạn",
        content:
          "Tin tìm đồ đã hết hạn 30 ngày. Hệ thống Guardian đã hoàn lại tiền ký quỹ cho bạn.",
        metadata: { post_id: post.id, item_id: post.itemId },
      });

      if (holdingTx) {
        await notificationService.notifyPaymentRefunded({
          receiverId: post.ownerId,
          amount: holdingTx.amount,
          transactionId: holdingTx.transactionCode || holdingTx.id,
          status: "refunded",
          postId: post.id,
        });
      }

      logger.info(`[RefundJob] Refunded post ${post.id}`);
    } catch (err) {
      // Log per-post error but continue processing remaining posts
      logger.error(`[RefundJob] Failed to refund post ${post.id}:`, err);
    }
  }
}

/** Start the scheduled job. Returns the cron task so callers can stop it. */
export function startRefundJob(): ScheduledTask {
  const task = cron.schedule("0 0 * * *", () => {
    logger.info("[RefundJob] Starting nightly Guardian refund sweep...");
    runRefundJob().catch((err) =>
      logger.error("[RefundJob] Unhandled error:", err)
    );
  });

  logger.info("[RefundJob] Guardian 30-day refund job scheduled (daily 00:00)");
  return task;
}
