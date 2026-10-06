import { logger } from "../../libs/logger";
import { prisma } from "../../libs/prisma";
import { notificationPreferenceRepository } from "./notification.preference.repository";
import { notificationService } from "./notification.service";
import { NotificationTemplates } from "./notification.template";

export interface DigestResult {
  processedUsers: number;
  notificationsCreated: number;
  skippedQuietHours: number;
  skippedNoData: number;
  details: Array<{
    userId: string;
    type: string;
    title: string;
    created: boolean;
    reason?: string;
  }>;
}

export class NotificationScheduler {
  /**
   * Returns current time in HH:mm format rounded to 15-minute bucket.
   * e.g., 19:32 -> "19:30"
   */
  getCurrentTimeBucket(date = new Date()): string {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 15) * 15;
    const hoursStr = String(date.getHours()).padStart(2, "0");
    const minsStr = String(roundedMinutes).padStart(2, "0");
    return `${hoursStr}:${minsStr}`;
  }

  /**
   * Execute Daily Digest job for all eligible users in current time bucket.
   */
  async runDailyDigestJob(options?: {
    dryRun?: boolean;
    targetTimeBucket?: string;
  }): Promise<DigestResult> {
    const isDryRun = options?.dryRun ?? false;
    const timeBucket = options?.targetTimeBucket ?? this.getCurrentTimeBucket();
    const todayDateStr = new Date().toISOString().slice(0, 10);

    logger.info(
      `[NotificationScheduler] Starting daily digest job for timeBucket=${timeBucket}, dryRun=${isDryRun}`
    );

    const preferences =
      await notificationPreferenceRepository.findEligibleUsersForDigest(
        timeBucket
      );

    const result: DigestResult = {
      processedUsers: preferences.length,
      notificationsCreated: 0,
      skippedQuietHours: 0,
      skippedNoData: 0,
      details: [],
    };

    if (preferences.length === 0) {
      logger.info(
        `[NotificationScheduler] No users scheduled for digest at ${timeBucket}`
      );
      return result;
    }

    for (const pref of preferences) {
      const userId = pref.userId;

      try {
        // 1. Check if user has active LOST items (Owner Progress Digest)
        const lostItems = await prisma.item.findMany({
          where: { ownerId: userId, status: "LOST" },
          take: 3,
        });

        if (lostItems.length > 0 && lostItems[0]) {
          const item = lostItems[0];
          const dedupeKey = `item-progress:${userId}:${item.id}:${todayDateStr}`;

          const template = NotificationTemplates.itemProgressDigest(
            item.name,
            3
          );

          if (isDryRun) {
            result.details.push({
              userId,
              type: template.type,
              title: template.title,
              created: false,
              reason: "DRY_RUN",
            });
            result.notificationsCreated++;
            continue;
          }

          const created = await notificationService.createNotification({
            receiverId: userId,
            category: template.category,
            type: template.type,
            title: template.title,
            content: template.content,
            dedupeKey,
            metadata: {
              item_id: item.id,
              deeplink: template.deeplink,
            },
            pushPriority: "normal",
          });

          if (created) {
            result.notificationsCreated++;
            result.details.push({
              userId,
              type: template.type,
              title: template.title,
              created: true,
            });
          }
          continue;
        }

        // 2. Check if there are nearby LOST items from others (Nearby Digest)
        const userLoc = await prisma.userLocation.findUnique({
          where: { userId },
        });

        if (userLoc && pref.nearbyAlertsEnabled) {
          const nearbyCount = await prisma.item.count({
            where: {
              status: "LOST",
              ownerId: { not: userId },
            },
          });

          if (nearbyCount > 0) {
            const dedupeKey = `daily-nearby:${userId}:${todayDateStr}`;
            const template = NotificationTemplates.dailyNearbyDigest(
              nearbyCount,
              "1.2km"
            );

            if (isDryRun) {
              result.details.push({
                userId,
                type: template.type,
                title: template.title,
                created: false,
                reason: "DRY_RUN",
              });
              result.notificationsCreated++;
              continue;
            }

            const created = await notificationService.createNotification({
              receiverId: userId,
              category: template.category,
              type: template.type,
              title: template.title,
              content: template.content,
              dedupeKey,
              metadata: {
                count: nearbyCount,
                deeplink: template.deeplink,
              },
              pushPriority: "normal",
            });

            if (created) {
              result.notificationsCreated++;
              result.details.push({
                userId,
                type: template.type,
                title: template.title,
                created: true,
              });
            }
            continue;
          }
        }

        result.skippedNoData++;
        result.details.push({
          userId,
          type: "NONE",
          title: "N/A",
          created: false,
          reason: "NO_NEW_DATA",
        });
      } catch (err: any) {
        logger.error(
          `[NotificationScheduler] Failed to process digest for user ${userId}:`,
          err
        );
      }
    }

    logger.info(
      `[NotificationScheduler] Finished digest job. Processed=${result.processedUsers}, Created=${result.notificationsCreated}`
    );

    return result;
  }
}

export const notificationScheduler = new NotificationScheduler();
