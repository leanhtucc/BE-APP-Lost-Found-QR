import { createServer } from "http";
import app from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { ENV } from "./config/env";
import { assertPhase4TestDatabaseSafety } from "./config/phase4-test-safety";
import { assertNonProductionDatabaseSafety } from "./config/database-safety";
import { startDailyNotificationJob } from "./jobs/daily-notification.job";
import { startRefundJob } from "./jobs/refund.job";
import { startAccountDeletionJob } from "./jobs/account-deletion.job";
import { logger } from "./libs/logger";
import { redis } from "./libs/redis";
import { notificationService } from "./modules/notification/notification.service";
import {
  initializeSocketServer,
  shutdownSocketServer,
} from "./socket/radar.socket";

async function startServer() {
  logger.info("Initializing server startup...");

  try {
    assertNonProductionDatabaseSafety({
      nodeEnv: ENV.NODE_ENV,
      databaseUrl: ENV.DATABASE_URL,
      directUrl: ENV.DIRECT_URL,
      allowRemoteNonProductionDatabase:
        ENV.ALLOW_REMOTE_NON_PRODUCTION_DATABASE,
    });

    if (process.env.PHASE4_MANUAL_TEST === "true") {
      assertPhase4TestDatabaseSafety({
        databaseUrl: ENV.DATABASE_URL,
        directUrl: ENV.DIRECT_URL,
        testDatabaseUrl:
          process.env.PHASE4_TEST_DATABASE_URL || process.env.DATABASE_URL_TEST,
        productionDatabaseUrl: process.env.PHASE4_PRODUCTION_DATABASE_URL,
        explicitlyConfirmed:
          process.env.PHASE4_TEST_DATABASE_CONFIRMED === "true",
      });
      logger.success("Phase 4 TEST database safety guard passed");
    }

    await connectDatabase();

    const httpServer = createServer(app);
    initializeSocketServer(httpServer);
    notificationService.startCleanupJob();
    startRefundJob();
    startDailyNotificationJob();
    startAccountDeletionJob();

    const server = httpServer.listen(ENV.PORT, "0.0.0.0", () => {
      logger.success(`Server is running on port ${ENV.PORT}`);
      logger.info(`Local URL: http://localhost:${ENV.PORT}`);
      logger.info(`Environment: ${ENV.NODE_ENV}`);
    });

    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.warn("Shutting down gracefully...");

      const forceTimer = setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10_000);
      forceTimer.unref();

      server.close(async () => {
        try {
          notificationService.stopCleanupJob();
          await shutdownSocketServer();
          await redis.disconnect();
          await disconnectDatabase();
          clearTimeout(forceTimer);
          logger.info("Server closed");
          process.exit(0);
        } catch (error) {
          logger.error("Graceful shutdown failed", error);
          process.exit(1);
        }
      });
    };

    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

void startServer();
