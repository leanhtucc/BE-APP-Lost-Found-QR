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
  optionalAuth: (_req: any, _res: any, next: any) => next(),
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
});
