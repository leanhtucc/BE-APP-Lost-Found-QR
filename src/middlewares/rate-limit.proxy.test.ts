import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit.middleware";

describe("rate limit client IP behind proxy", () => {
  it("uses forwarded client IPs as independent buckets", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.get(
      "/limited",
      rateLimit({ windowMs: 60_000, max: 1 }),
      (_req, res) => {
        res.status(200).send("ok");
      }
    );

    expect(
      (
        await request(app)
          .get("/limited")
          .set("X-Forwarded-For", "198.51.100.1")
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .get("/limited")
          .set("X-Forwarded-For", "198.51.100.1")
      ).status
    ).toBe(429);
    expect(
      (await request(app).get("/limited").set("X-Forwarded-For", "203.0.113.2"))
        .status
    ).toBe(200);
  });
});
