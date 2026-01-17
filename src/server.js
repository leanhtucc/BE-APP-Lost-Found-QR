"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = require("./config/database");
const env_1 = require("./config/env");
const logger_1 = require("./libs/logger");
/**
 * Server Entry Point
 */
async function startServer() {
    try {
        // Connect to database
        await (0, database_1.connectDatabase)();
        // Start server
        const server = app_1.default.listen(env_1.ENV.PORT, "0.0.0.0", () => {
            logger_1.logger.success(`🚀 Server is running on port ${env_1.ENV.PORT}`);
            logger_1.logger.info(`📍 http://localhost:${env_1.ENV.PORT}`);
            logger_1.logger.info(`🌍 Environment: ${env_1.ENV.NODE_ENV}`);
        });
        // Graceful shutdown
        const shutdown = async () => {
            logger_1.logger.warn("⚠️  Shutting down gracefully...");
            server.close(async () => {
                await (0, database_1.disconnectDatabase)();
                logger_1.logger.info("👋 Server closed");
                process.exit(0);
            });
            // Force shutdown after 10s
            setTimeout(() => {
                logger_1.logger.error("❌ Forced shutdown");
                process.exit(1);
            }, 10000);
        };
        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }
    catch (error) {
        logger_1.logger.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=server.js.map