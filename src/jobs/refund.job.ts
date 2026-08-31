import cron, { ScheduledTask } from "node-cron";
import { logger } from "../libs/logger";
import { reportService } from "../modules/report/report.service";

/**
 * Expires abandoned Guardian payment windows. It never changes an Item to LOST:
 * only a verified PAID webhook is allowed to do that.
 */
async function runGuardianPaymentExpiryJob(): Promise<void> {
  const expired = await reportService.expirePendingReports();
  logger.info(`[GuardianPaymentExpiry] Expired ${expired} pending report(s)`);
}

export function startRefundJob(): ScheduledTask {
  const task = cron.schedule("*/15 * * * *", () => {
    runGuardianPaymentExpiryJob().catch((error) =>
      logger.error("[GuardianPaymentExpiry] Unhandled error:", error)
    );
  });
  logger.info("[GuardianPaymentExpiry] Pending-payment expiry job scheduled (every 15 minutes)");
  return task;
}
