import "dotenv/config";
import { defineConfig } from "prisma/config";

const rawDatabaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const databaseUrl = rawDatabaseUrl?.replace(
  /([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/,
  "$1sslmode=verify-full"
);

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
