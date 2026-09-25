import "dotenv/config";
import { assertPhase4TestDatabaseSafety } from "./config/phase4-test-safety";

const testDatabaseUrl =
  process.env.PHASE4_TEST_DATABASE_URL || process.env.DATABASE_URL_TEST;
const productionDatabaseUrl =
  process.env.PHASE4_PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

assertPhase4TestDatabaseSafety({
  databaseUrl: testDatabaseUrl,
  directUrl: testDatabaseUrl,
  testDatabaseUrl,
  productionDatabaseUrl,
  explicitlyConfirmed: process.env.PHASE4_TEST_DATABASE_CONFIRMED === "true",
});

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = testDatabaseUrl;
process.env.PHASE4_TEST_DATABASE_URL = testDatabaseUrl;
process.env.PHASE4_PRODUCTION_DATABASE_URL = productionDatabaseUrl;
process.env.PHASE4_MANUAL_TEST = "true";

async function startPhase4TestServer(): Promise<void> {
  await import("./server.js");
}

void startPhase4TestServer();
