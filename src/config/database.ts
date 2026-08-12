import { logger } from "../libs/logger";
import { prisma } from "../libs/prisma";

export { prisma };

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.success("Database connected successfully");
  } catch (error) {
    logger.error("Database connection failed", error);
    throw error;
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}
