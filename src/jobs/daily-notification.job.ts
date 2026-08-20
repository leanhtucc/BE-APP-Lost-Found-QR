import cron, { ScheduledTask } from "node-cron";
import { logger } from "../libs/logger";
import { notificationScheduler } from "../modules/notification/notification.scheduler";

/**
 * Daily Notification Cron Job
 * Runs every 15 minutes (0, 15, 30, 45).
 * Checks current time bucket and triggers daily digest / reminders for matching users.
 */
export function startDailyNotificationJob(): ScheduledTask {
  const task = cron.schedule("*/15 * * * *", () => {
    logger.info("[DailyNotificationJob] Triggering 15-minute notification digest sweep...");
    notificationScheduler
      .runDailyDigestJob()
      .then((res) => {
        logger.info(
          `[DailyNotificationJob] Digest sweep complete. Processed=${res.processedUsers}, Created=${res.notificationsCreated}`
        );
      })
      .catch((err) => {
        logger.error("[DailyNotificationJob] Unhandled error during digest sweep:", err);
      });
  });

  logger.info("[DailyNotificationJob] Daily notification digest job scheduled (every 15 mins)");
  return task;
}
