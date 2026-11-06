import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STRONG_A = "a".repeat(40);
const STRONG_B = "b".repeat(40);
const STRONG_C = "c".repeat(40);

function baseEnv(overrides: Record<string, string> = {}) {
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
  vi.stubEnv("JWT_SECRET", STRONG_A);
  vi.stubEnv("JWT_REFRESH_SECRET", STRONG_B);
  vi.stubEnv("GUEST_JWT_SECRET", STRONG_C);
  vi.stubEnv("HANDOVER_CODE_SALT", "");
  vi.stubEnv("STREAM_TOKEN_TTL_SECONDS", "");
  for (const [k, v] of Object.entries(overrides)) vi.stubEnv(k, v);
}

async function loadEnv() {
  vi.resetModules();
  return (await import("./env.js")).ENV;
}

describe("handover code salt configuration", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("is required in production", async () => {
    baseEnv({ NODE_ENV: "production" });
    await expect(loadEnv()).rejects.toThrow(/HANDOVER_CODE_SALT is required/);
  });

  it("must differ from the JWT secrets", async () => {
    baseEnv({ NODE_ENV: "production", HANDOVER_CODE_SALT: STRONG_A });
    await expect(loadEnv()).rejects.toThrow(/must be distinct/);
  });

  it("uses the configured value when it is strong and distinct", async () => {
    const salt = "d".repeat(40);
    baseEnv({ NODE_ENV: "production", HANDOVER_CODE_SALT: salt });
    expect((await loadEnv()).HANDOVER_CODE_SALT).toBe(salt);
  });

  it("derives a stable, non-hardcoded value outside production", async () => {
    baseEnv({ NODE_ENV: "test" });
    const first = (await loadEnv()).HANDOVER_CODE_SALT;
    const second = (await loadEnv()).HANDOVER_CODE_SALT;
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("lost_found_handover_salt");

    baseEnv({ NODE_ENV: "test", JWT_SECRET: "z".repeat(40) });
    expect((await loadEnv()).HANDOVER_CODE_SALT).not.toBe(first);
  });

  it("rejects a salt shorter than 32 characters", async () => {
    baseEnv({ NODE_ENV: "test", HANDOVER_CODE_SALT: "short" });
    await expect(loadEnv()).rejects.toThrow();
  });
});

describe("stream token lifetime configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to one hour and rejects absurd values", async () => {
    baseEnv({ NODE_ENV: "test" });
    expect((await loadEnv()).STREAM_TOKEN_TTL_SECONDS).toBe(3600);

    baseEnv({ NODE_ENV: "test", STREAM_TOKEN_TTL_SECONDS: "10" });
    await expect(loadEnv()).rejects.toThrow();
  });
});
