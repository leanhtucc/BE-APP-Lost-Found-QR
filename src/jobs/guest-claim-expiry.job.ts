import cron, { ScheduledTask } from "node-cron";
import { logger } from "../libs/logger";
import { guestClaimLifecycleService } from "../modules/return/guest-claim-lifecycle.service";

export function startGuestClaimExpiryJob(): ScheduledTask {
  const task = cron.schedule("*/15 * * * *", () => {
    guestClaimLifecycleService
      .expireAbandonedGuestClaims()
      .then((expired) =>
        logger.info(`[GuestClaimExpiry] Expired ${expired} abandoned claim(s)`)
      )
      .catch((error) => logger.error("[GuestClaimExpiry] Job failed", error));
  });
  logger.info(
    "[GuestClaimExpiry] Guest claim expiry scheduled (every 15 minutes)"
  );
  return task;
}
