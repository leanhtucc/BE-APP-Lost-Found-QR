import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError, errorHandler } from "./error.middleware";

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
