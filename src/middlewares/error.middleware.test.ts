import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError, errorHandler } from "./error.middleware";
import { z } from "zod";
import { validate } from "./validate.middleware";
import { rateLimit } from "./rate-limit.middleware";

function createErrorApp(error: Error) {
  const app = express();
  app.get("/failure", (_req, _res, next) => next(error));
  app.use(errorHandler);
  return app;
}

describe("error middleware contract", () => {
  it("returns the stable 500 contract for an unexpected error", async () => {
    const response = await request(
      createErrorApp(new Error("test failure"))
    ).get("/failure");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      status: 500,
      success: false,
      message: "Internal server error",
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it.each([
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
  ])("maps HTTP %i to the stable %s code", async (status, code) => {
    const response = await request(
      createErrorApp(new AppError("Operational failure", status))
    ).get("/failure");

    expect(response.body).toMatchObject({
      status,
      success: false,
      error: { code },
    });
  });

  it("returns the validation contract for malformed input", async () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/validate",
      validate(z.object({ body: z.object({ name: z.string().min(1) }) })),
      (_req, res) => res.json({ success: true })
    );

    const response = await request(app).post("/validate").send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 400,
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("returns the stable rate-limit contract", async () => {
    const app = express();
    app.get("/limited", rateLimit({ windowMs: 60_000, max: 1 }), (_req, res) =>
      res.json({ success: true })
    );

    await request(app).get("/limited");
    const response = await request(app).get("/limited");

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({
      status: 429,
      success: false,
      error: { code: "RATE_LIMITED" },
    });
  });

  it("does not expose stack traces or internal exception messages", async () => {
    const response = await request(
      createErrorApp(new Error("database password is secret"))
    ).get("/failure");

    expect(JSON.stringify(response.body)).not.toContain("database password");
    expect(response.body.error).toEqual({ code: "INTERNAL_ERROR" });
  });

  it("keeps the HTTP status on coded operational errors", async () => {
    const response = await request(
      createErrorApp(new AppError("Forbidden", 403, true, "ITEM_FORBIDDEN"))
    ).get("/failure");

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      status: 403,
      success: false,
      error: { code: "ITEM_FORBIDDEN" },
    });
  });
});
