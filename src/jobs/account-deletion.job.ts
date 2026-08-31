import cron, { ScheduledTask } from "node-cron";
import { logger } from "../libs/logger";
import { prisma } from "../libs/prisma";

export async function anonymizeScheduledAccounts(limit = 100): Promise<number> {
  const dueUsers = await prisma.user.findMany({
    where: {
      scheduledDeletionAt: { lte: new Date() },
      anonymizedAt: null,
    },
    select: { id: true },
    take: limit,
    orderBy: { scheduledDeletionAt: "asc" },
  });

  for (const { id } of dueUsers) {
    await prisma.$transaction(async (tx) => {
      await tx.userDevice.deleteMany({ where: { userId: id } });
      await tx.user.update({
        where: { id },
        data: {
          uid: `deleted_${id}`,
          memberId: `DELETED_${id}`,
          email: `deleted+${id}@anonymized.invalid`,
          displayName: "Deleted User",
          photoURL: null,
          pushToken: null,
          phoneNumber: null,
          addressCity: null,
          bio: null,
          privacySettings: {},
          password: null,
          verificationCode: null,
          verificationCodeExpiry: null,
          googleId: null,
          resetPasswordExpiry: null,
          resetPasswordToken: null,
          isVerified: false,
          role: "deleted",
          tokenVersion: { increment: 1 },
          anonymizedAt: new Date(),
        },
      });
      await tx.securityAuditLog.create({
        data: { userId: id, action: "ACCOUNT_ANONYMIZED" },
      });
    });
  }

  return dueUsers.length;
}

export function startAccountDeletionJob(): ScheduledTask {
  const task = cron.schedule("17 3 * * *", () => {
    anonymizeScheduledAccounts()
      .then((count) => {
        if (count > 0) {
          logger.info(`[AccountDeletionJob] Anonymized ${count} account(s)`);
        }
      })
      .catch((error) =>
        logger.error("[AccountDeletionJob] Unhandled error", error)
      );
  });

  logger.info("[AccountDeletionJob] Account anonymization scheduled daily");
  return task;
}
