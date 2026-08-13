import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` must also work during dependency installation, before
  // deployment secrets are injected. Migrate commands still require this URL.
  datasource: databaseUrl ? { url: databaseUrl } : undefined,
});
