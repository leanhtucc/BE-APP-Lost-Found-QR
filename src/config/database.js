"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const client_1 = require("@prisma/client");
const env_1 = require("./env");
exports.prisma = new client_1.PrismaClient({
    log: env_1.isDevelopment ? ["query", "error", "warn"] : ["error"],
});
async function connectDatabase() {
    try {
        await exports.prisma.$connect();
        console.log("✅ Database connected successfully");
    }
    catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
}
async function disconnectDatabase() {
    await exports.prisma.$disconnect();
    console.log("🔌 Database disconnected");
}
//# sourceMappingURL=database.js.map