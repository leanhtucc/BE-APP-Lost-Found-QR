console.log(">>> [STARTUP] Starting server.ts file execution...");
import { createServer } from "http";
import app from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { ENV } from "./config/env";
import { logger } from "./libs/logger";
import { redis } from "./libs/redis";
import { notificationService } from "./modules/notification/notification.service";
import {
  initializeSocketServer,
  shutdownSocketServer,
} from "./socket/radar.socket";

/**
 * Server Entry Point
 */

async function startServer() {
  console.log(">>> [STARTUP] Inside startServer function...");
  logger.info("Initializing server startup...");
  try {
    // Connect to database
    console.log(">>> [STARTUP] Attempting to connect to database...");
    await connectDatabase();
    console.log(">>> [STARTUP] Database connection call finished.");

    // Start server
    console.log(`>>> [STARTUP] Attempting to listen on port ${ENV.PORT}...`);
    const httpServer = createServer(app);
    initializeSocketServer(httpServer);
    notificationService.startCleanupJob();

    const server = httpServer.listen(ENV.PORT, "0.0.0.0", () => {
      logger.success(`🚀 Server is running on port ${ENV.PORT}`);
      logger.info(`📍 http://localhost:${ENV.PORT}`);
      logger.info(`🌍 Environment: ${ENV.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.warn("⚠️  Shutting down gracefully...");

      server.close(async () => {
        notificationService.stopCleanupJob();
        await shutdownSocketServer();
        await redis.disconnect();
        await disconnectDatabase();
        logger.info("👋 Server closed");
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.error("❌ Forced shutdown");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
