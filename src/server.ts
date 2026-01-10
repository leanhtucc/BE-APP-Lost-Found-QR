import app from "./app";
import { ENV } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { logger } from "./libs/logger";

/**
 * Server Entry Point
 */

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Start server
    const server = app.listen(ENV.PORT, () => {
      logger.success(`🚀 Server is running on port ${ENV.PORT}`);
      logger.info(`📍 http://localhost:${ENV.PORT}`);
      logger.info(`🌍 Environment: ${ENV.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.warn("⚠️  Shutting down gracefully...");
      
      server.close(async () => {
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
