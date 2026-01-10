import { PrismaClient } from "@prisma/client";
import { isDevelopment } from "../config/env";

/**
 * Prisma Client Instance
 * Singleton pattern để tránh tạo nhiều instance
 */

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: isDevelopment ? ["query", "error", "warn"] : ["error"],
  });

if (isDevelopment) {
  global.prisma = prisma;
}
