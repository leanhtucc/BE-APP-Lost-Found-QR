import { PrismaClient } from "@prisma/client";
/**
 * Prisma Client Instance
 * Singleton pattern để tránh tạo nhiều instance
 */
declare global {
    var prisma: PrismaClient | undefined;
}
export declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
//# sourceMappingURL=prisma.d.ts.map