import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const db = vi.hoisted(() => ({
  upsert: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock("../../libs/prisma", () => ({ prisma: { foundReport: db } }));
vi.mock("../../middlewares/auth.middleware", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    if (!req.headers.authorization)
      return res.status(401).json({ success: false });
    req.user = { id: "finder-1" };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers.authorization) {
      req.user = { id: "finder-1" };
    }
    next();
  },
}));
import router from "./found-report.routes";
import { getFoundFeed } from "./found-report.service";

const app = express();
app.use(express.json());
app.use("/found-reports", router);
const body = {
  idempotencyKey: "2cf67492-277c-414f-a3c7-dc8540a23586",
  name: "Ví da",
  category: "wallet",
  imagePublicUrl: "https://example.com/wallet.jpg",
  description: "Ví màu nâu",
  location: { lat: 21.02, lng: 105.83, address: "Sảnh toà A" },
};
const record = {
  id: "report-1",
  finderId: "finder-1",
  name: body.name,
  category: body.category,
  imagePublicUrl: body.imagePublicUrl,
  description: body.description,
  ...body.location,
  createdAt: new Date("2026-09-07T00:00:00Z"),
  resolvedAt: null,
};

beforeEach(() => vi.resetAllMocks());
describe("found reports", () => {
  it("requires authentication", async () => {
    expect((await request(app).post("/found-reports").send(body)).status).toBe(
      401
    );
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it.each([
    { ...body, location: undefined },
    { ...body, location: { ...body.location, address: "   " } },
    { ...body, location: { ...body.location, lat: 91 } },
    { ...body, location: { ...body.location, lng: -181 } },
    { ...body, imagePublicUrl: "file:///image.jpg" },
  ])("rejects incomplete/invalid report before writing", async (invalid) => {
    const response = await request(app)
      .post("/found-reports")
      .set("Authorization", "test")
      .send(invalid);
    expect(response.status).toBe(400);
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("persists structured location and finder with a stable retry key", async () => {
    db.upsert.mockResolvedValue(record);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request(app)
        .post("/found-reports")
        .set("Authorization", "test")
        .send(body);
      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe("report-1");
    }
    expect(db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          finderId_idempotencyKey: {
            finderId: "finder-1",
            idempotencyKey: body.idempotencyKey,
          },
        },
        update: {},
        create: expect.objectContaining({
          finderId: "finder-1",
          ...body.location,
          imagePublicUrl: body.imagePublicUrl,
        }),
      })
    );
  });
  it("keeps own report visible outside radius and filters distant public reports", async () => {
    db.findMany.mockResolvedValueOnce([record]).mockResolvedValueOnce([
      { ...record, id: "near", finderId: "other", lat: 0, lng: 0 },
      { ...record, id: "far", finderId: "other", lat: 50, lng: 50 },
    ]);
    const cards = await getFoundFeed("finder-1", {
      lat: 0,
      lng: 0,
      radius: 100,
    });
    expect(cards.map((card) => card.itemId)).toEqual([
      "found:report-1",
      "found:near",
    ]);
    expect(cards[0]).toMatchObject({
      isOwn: true,
      reportType: "FOUND",
      address: body.location.address,
    });
    expect(cards[0]).not.toHaveProperty("finderId");
  });
  it("loads a public report detail without selecting private finder fields", async () => {
    db.findUnique.mockResolvedValue(record);
    const response = await request(app).get("/found-reports/report-1");
    expect(response.status).toBe(200);
    expect(db.findUnique.mock.calls[0]![0].select).not.toHaveProperty(
      "finderId"
    );
    expect(db.findUnique.mock.calls[0]![0].select).not.toHaveProperty("finder");
  });
  it("returns 404 for an unknown report", async () => {
    db.findUnique.mockResolvedValue(null);
    expect((await request(app).get("/found-reports/missing")).status).toBe(404);
  });

  describe("GET /found-reports/feed", () => {
    it("returns public feed pins and cards for guest users without exposing finder identity", async () => {
      db.findMany.mockResolvedValueOnce([
        {
          ...record,
          id: "report-10",
          finderId: "stranger",
          lat: 21.02,
          lng: 105.83,
        },
      ]);

      const response = await request(app)
        .get("/found-reports/feed")
        .query({ lat: 21.02, lng: 105.83, radius: 5000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cards).toHaveLength(1);
      expect(response.body.data.pins).toHaveLength(1);
      expect(response.body.data.totalCount).toBe(1);

      const card = response.body.data.cards[0];
      expect(card.itemId).toBe("found:report-10");
      expect(card.reportType).toBe("FOUND");
      expect(card.isOwn).toBe(false);
      expect(card.ownerDisplayName).toBe("Người nhặt được");
      expect(card).not.toHaveProperty("finderId");
      expect(card).not.toHaveProperty("finder");

      const pin = response.body.data.pins[0];
      expect(pin.itemId).toBe("found:report-10");
      expect(pin.lat).toBe(21.02);
      expect(pin.lng).toBe(105.83);
      expect(pin.isOwn).toBe(false);
    });

    it("prefilters with bounding box and category in database query for authenticated users", async () => {
      db.findMany
        .mockResolvedValueOnce([]) // own
        .mockResolvedValueOnce([]); // nearby

      const response = await request(app)
        .get("/found-reports/feed")
        .set("Authorization", "test")
        .query({ lat: 21.02, lng: 105.83, radius: 2000, category: "wallet" });

      expect(response.status).toBe(200);
      expect(db.findMany).toHaveBeenCalledTimes(2);

      const nearbyCall = db.findMany.mock.calls[1]![0];
      expect(nearbyCall.where).toMatchObject({
        resolvedAt: null,
        category: "wallet",
        lat: expect.objectContaining({
          gte: expect.any(Number),
          lte: expect.any(Number),
        }),
        lng: expect.objectContaining({
          gte: expect.any(Number),
          lte: expect.any(Number),
        }),
      });
    });

    it("handles zero coordinates correctly (equator/meridian)", async () => {
      db.findMany.mockResolvedValueOnce([
        { ...record, id: "report-zero", finderId: "other", lat: 0, lng: 0 },
      ]);

      const response = await request(app)
        .get("/found-reports/feed")
        .query({ lat: 0, lng: 0, radius: 1000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cards).toHaveLength(1);
    });

    it("rejects invalid coordinates with 400 Bad Request", async () => {
      const response = await request(app)
        .get("/found-reports/feed")
        .query({ lat: 95, lng: 105.83 });

      expect(response.status).toBe(400);
      expect(db.findMany).not.toHaveBeenCalled();
    });

    it("returns empty cards and pins when no reports are found", async () => {
      db.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/found-reports/feed")
        .query({ lat: 21.02, lng: 105.83, radius: 1000 });

      expect(response.status).toBe(200);
      expect(response.body.data.cards).toEqual([]);
      expect(response.body.data.pins).toEqual([]);
      expect(response.body.data.totalCount).toBe(0);
    });

    it("strictly omits sensitive fields (finderId, idempotencyKey, email, phone, handover) from public response", async () => {
      db.findMany.mockResolvedValueOnce([
        {
          id: "rep-secret",
          name: "Ví da",
          category: "wallet",
          description: "Nhặt được tại quán cà phê",
          imagePublicUrl: "https://example.com/item.jpg",
          lat: 21.02,
          lng: 105.83,
          address: "123 Phố Huế",
          createdAt: new Date(),
          resolvedAt: null,
          finderId: "user-secret-999",
          idempotencyKey: "secret-key-123",
        },
      ]);

      const response = await request(app)
        .get("/found-reports/feed")
        .query({ lat: 21.02, lng: 105.83, radius: 1000 });

      expect(response.status).toBe(200);
      const card = response.body.data.cards[0];
      const pin = response.body.data.pins[0];

      // Privacy checks
      expect(card).not.toHaveProperty("finderId");
      expect(card).not.toHaveProperty("idempotencyKey");
      expect(card).not.toHaveProperty("email");
      expect(card).not.toHaveProperty("phone");
      expect(card).not.toHaveProperty("handover");
      expect(card).not.toHaveProperty("verificationCode");

      expect(pin).not.toHaveProperty("finderId");
      expect(pin).not.toHaveProperty("idempotencyKey");
    });
  });
});
