import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { isDevelopment } from "../config/env";
import { ENV } from "../config/env";

/**
 * Prisma Client Instance
 * Singleton pattern để tránh tạo nhiều instance
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = ENV.DATABASE_URL.replace(
  /([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/,
  "$1sslmode=verify-full"
);

const adapter = new PrismaPg({
  connectionString: databaseUrl,
  max: isDevelopment ? 5 : 10,
  connectionTimeoutMillis: 15_000,
});

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: isDevelopment ? ["query", "error", "warn"] : ["error"],
  });

if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}
