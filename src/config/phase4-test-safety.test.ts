import { describe, expect, it } from "vitest";
import { assertPhase4TestDatabaseSafety } from "./phase4-test-safety";

const production =
  "postgresql://postgres.prodref@pooler.example.com:5432/postgres";
const test = "postgresql://postgres.testref@pooler.example.com:5432/postgres";

describe("Phase 4 test database safety", () => {
  it("accepts two explicitly confirmed, distinct Supabase-style projects", () => {
    expect(() =>
      assertPhase4TestDatabaseSafety({
        databaseUrl: test,
        directUrl: test,
        testDatabaseUrl: test,
        productionDatabaseUrl: production,
        explicitlyConfirmed: true,
      })
    ).not.toThrow();
  });

  it("rejects production in either runtime database variable", () => {
    expect(() =>
      assertPhase4TestDatabaseSafety({
        databaseUrl: test,
        directUrl: production,
        testDatabaseUrl: test,
        productionDatabaseUrl: production,
        explicitlyConfirmed: true,
      })
    ).toThrow(/resolves to production/);
  });

  it("rejects a declared test database equal to production", () => {
    expect(() =>
      assertPhase4TestDatabaseSafety({
        databaseUrl: production,
        directUrl: production,
        testDatabaseUrl: production,
        productionDatabaseUrl: production,
        explicitlyConfirmed: true,
      })
    ).toThrow(/Test database resolves to production/);
  });

  it("fails closed when a remote test classification is not proven", () => {
    expect(() =>
      assertPhase4TestDatabaseSafety({
        databaseUrl: test,
        directUrl: test,
        testDatabaseUrl: test,
        productionDatabaseUrl: production,
      })
    ).toThrow(/classification cannot be proven/);
  });
});
