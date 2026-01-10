import { PrismaClient } from "@prisma/client";
import { ENV, isDevelopment } from "./env";

export const prisma = new PrismaClient({
  log: isDevelopment ? ["query", "error", "warn"] : ["error"],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log("🔌 Database disconnected");
}
