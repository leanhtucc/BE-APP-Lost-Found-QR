import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("./item.controller", () => ({
  // Every handler just answers 200; we only care about the route's middleware.
  ItemController: class {
    constructor() {
      return new Proxy(
        {},
        {
          get: () => (_req: unknown, res: express.Response) =>
            res.status(200).json({ ok: true }),
        }
      );
    }
  },
}));
vi.mock("../../middlewares/auth.middleware", () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import itemRouter from "./item.routes";

function buildApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api", itemRouter);
  return app;
}

describe("GET /api/scan/:itemId rate limit", () => {
  it("throttles one client after 30 scans per minute but not others", async () => {
    const app = buildApp();
    const scan = (ip: string) =>
      request(app).get("/api/scan/ABC123xyz").set("X-Forwarded-For", ip);

    for (let i = 0; i < 30; i++) {
      expect((await scan("198.51.100.7")).status).toBe(200);
    }
    expect((await scan("198.51.100.7")).status).toBe(429);
    expect((await scan("203.0.113.9")).status).toBe(200);
  });
});
