import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mapMock = vi.hoisted(() => ({
  autocomplete: vi.fn(),
  getPlaceDetails: vi.fn(),
  getNearby: vi.fn(),
  countActiveUsers: vi.fn(),
  reverseGeocode: vi.fn(),
  geocode: vi.fn(),
}));

vi.mock("./map.service", () => ({
  mapService: mapMock,
}));

vi.mock("../../libs/prisma", () => ({
  prisma: {},
}));

import mapRouter from "./map.routes";
import { rateLimit } from "../../middlewares/rate-limit.middleware";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use("/map", mapRouter);

describe("Map Search Endpoints Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /map/autocomplete", () => {
    it("returns predictions for valid input with sessiontoken for unauthenticated guests", async () => {
      mapMock.autocomplete.mockResolvedValueOnce([
        {
          place_id: "place-ptit-1",
          description:
            "Học viện Công nghệ Bưu chính Viễn thông, Hà Đông, Hà Nội",
          main_text: "Học viện Công nghệ Bưu chính Viễn thông",
          secondary_text: "Hà Đông, Hà Nội",
        },
      ]);

      const response = await request(app).get("/map/autocomplete").query({
        input: "PTIT",
        sessiontoken: "session-uuid-1234",
        lat: 20.98,
        lng: 105.78,
        radius: 5000,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].place_id).toBe("place-ptit-1");

      expect(mapMock.autocomplete).toHaveBeenCalledWith(
        "PTIT",
        expect.objectContaining({
          sessionToken: "session-uuid-1234",
          lat: 20.98,
          lng: 105.78,
          radius: 5000,
        })
      );

      // Verify no secret API key is exposed in payload
      expect(JSON.stringify(response.body)).not.toContain("AIzaSy");
    });

    it("rejects request without input or query with 400 Bad Request", async () => {
      const response = await request(app).get("/map/autocomplete").query({});
      expect(response.status).toBe(400);
      expect(mapMock.autocomplete).not.toHaveBeenCalled();
    });

    it("rejects input exceeding 200 characters with 400 Bad Request", async () => {
      const longInput = "a".repeat(201);
      const response = await request(app)
        .get("/map/autocomplete")
        .query({ input: longInput });
      expect(response.status).toBe(400);
      expect(mapMock.autocomplete).not.toHaveBeenCalled();
    });
  });

  describe("GET /map/place-details", () => {
    it("returns place details for valid place_id with sessiontoken", async () => {
      mapMock.getPlaceDetails.mockResolvedValueOnce({
        place_id: "place-ptit-1",
        name: "PTIT Hà Đông",
        formatted_address: "Km10, Đường Nguyễn Trãi, Hà Đông, Hà Nội",
        lat: 20.9805,
        lng: 105.7876,
      });

      const response = await request(app).get("/map/place-details").query({
        place_id: "place-ptit-1",
        sessiontoken: "session-uuid-1234",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lat).toBe(20.9805);
      expect(response.body.data.lng).toBe(105.7876);

      expect(mapMock.getPlaceDetails).toHaveBeenCalledWith(
        "place-ptit-1",
        "session-uuid-1234"
      );

      expect(JSON.stringify(response.body)).not.toContain("AIzaSy");
    });

    it("rejects request without place_id with 400 Bad Request", async () => {
      const response = await request(app).get("/map/place-details").query({});
      expect(response.status).toBe(400);
      expect(mapMock.getPlaceDetails).not.toHaveBeenCalled();
    });

    it("normalizes not-found place details into 404 response", async () => {
      mapMock.getPlaceDetails.mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/map/place-details")
        .query({ place_id: "non-existent-place" });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("PLACE_NOT_FOUND");
    });
  });

  describe("Places Rate Limiter & Client IP Isolation", () => {
    it("isolates rate limit counters between different client IPs", async () => {
      mapMock.autocomplete.mockResolvedValue([]);

      // Client 1 sends request from IP 1.2.3.4
      const res1 = await request(app)
        .get("/map/autocomplete")
        .set("X-Forwarded-For", "1.2.3.4")
        .query({ input: "Test IP 1" });
      expect(res1.status).toBe(200);

      // Client 2 sends request from IP 5.6.7.8
      const res2 = await request(app)
        .get("/map/autocomplete")
        .set("X-Forwarded-For", "5.6.7.8")
        .query({ input: "Test IP 2" });
      expect(res2.status).toBe(200);
    });

    it("triggers 429 when single IP exceeds limiter rate threshold", async () => {
      const customApp = express();
      customApp.set("trust proxy", 1);
      customApp.use(express.json());
      const testLimiter = rateLimit({ windowMs: 1000, max: 3 });
      customApp.get("/test-limit", testLimiter, (_req, res) => {
        res.json({ ok: true });
      });

      // Requests 1, 2, 3 succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(customApp)
          .get("/test-limit")
          .set("X-Forwarded-For", "9.9.9.9");
        expect(res.status).toBe(200);
      }

      // Request 4 from same IP triggers 429
      const res4 = await request(customApp)
        .get("/test-limit")
        .set("X-Forwarded-For", "9.9.9.9");
      expect(res4.status).toBe(429);
      expect(res4.body.error.code).toBe("RATE_LIMITED");

      // Request from DIFFERENT IP still succeeds
      const resOther = await request(customApp)
        .get("/test-limit")
        .set("X-Forwarded-For", "8.8.8.8");
      expect(resOther.status).toBe(200);
    });
  });
});
