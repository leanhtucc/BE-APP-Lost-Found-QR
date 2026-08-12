import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL =
    "postgresql://test:test@localhost:5432/test?sslmode=disable";
  process.env.JWT_SECRET = "test-jwt-secret-at-least-16-characters";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-16-characters";
  process.env.FIREBASE_CONFIG_PATH = "";

  const imported = await import("./app.js");
  const candidate = imported.default as unknown;
  app = ((candidate as { default?: Express })?.default ?? candidate) as Express;
}, 30_000);

describe("health endpoints", () => {
  it("reports the process as alive without requiring database access", async () => {
    const response = await request(app).get("/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, status: "alive" });
  });
});
