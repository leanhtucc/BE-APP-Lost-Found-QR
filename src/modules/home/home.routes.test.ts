import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ getLostFeed: vi.fn() }));

vi.mock("../../middlewares/auth.middleware", () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("./home.service", () => ({ homeService: service }));
vi.mock("../../libs/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import router from "./home.routes";

const app = express();
app.use(express.json());
app.use("/home", router);

describe("GET /home/lost-feed", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 instead of a global feed when GPS is missing", async () => {
    const response = await request(app).get("/home/lost-feed?lng=105.8342");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      fields: { lat: "lat is required" },
    });
    expect(service.getLostFeed).not.toHaveBeenCalled();
  });

  it("passes a server-capped radius to the service and keeps the response wrapper", async () => {
    service.getLostFeed.mockResolvedValue({
      cards: [],
      pins: [],
      myLostCount: 0,
      nearbyCount: 0,
    });

    const response = await request(app).get(
      "/home/lost-feed?lat=21.0278&lng=105.8342&radius=500000"
    );

    expect(response.status).toBe(200);
    expect(service.getLostFeed).toHaveBeenCalledWith(undefined, {
      lat: 21.0278,
      lng: 105.8342,
      radius: 10_000,
    });
    expect(response.body).toEqual({
      success: true,
      data: {
        user: null,
        lostFeed: {
          cards: [],
          pins: [],
          myLostCount: 0,
          nearbyCount: 0,
        },
      },
    });
  });
});
