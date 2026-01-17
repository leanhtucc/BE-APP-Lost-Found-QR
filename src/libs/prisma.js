"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const env_1 = require("../config/env");
exports.prisma = global.prisma ||
    new client_1.PrismaClient({
        log: env_1.isDevelopment ? ["query", "error", "warn"] : ["error"],
    });
if (env_1.isDevelopment) {
    global.prisma = exports.prisma;
}
//# sourceMappingURL=prisma.js.map