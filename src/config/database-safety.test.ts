import { describe, expect, it } from "vitest";
import { assertNonProductionDatabaseSafety } from "./database-safety";

const local = "postgresql://findback:secret@localhost:5433/lostfound_dev";
const remote = "postgresql://user:secret@db.example.com:5432/lostfound_test";

describe("non-production database safety", () => {
  it.each(["development", "test"] as const)(
    "accepts local %s databases",
    (nodeEnv) => {
      expect(() =>
        assertNonProductionDatabaseSafety({
          nodeEnv,
          databaseUrl: local,
          directUrl: local,
        })
      ).not.toThrow();
    }
  );

  it("blocks remote development/test targets unless explicitly acknowledged", () => {
    expect(() =>
      assertNonProductionDatabaseSafety({
        nodeEnv: "test",
        databaseUrl: remote,
        directUrl: remote,
      })
    ).toThrow(/Remote DATABASE_URL\/DIRECT_URL is blocked/);
  });

  it("permits an explicitly acknowledged remote non-production target", () => {
    expect(() =>
      assertNonProductionDatabaseSafety({
        nodeEnv: "test",
        databaseUrl: remote,
        directUrl: remote,
        allowRemoteNonProductionDatabase: true,
      })
    ).not.toThrow();
  });

  it("does not change production database selection", () => {
    expect(() =>
      assertNonProductionDatabaseSafety({
        nodeEnv: "production",
        databaseUrl: remote,
        directUrl: remote,
      })
    ).not.toThrow();
  });
});
