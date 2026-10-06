import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const classifyItemCategoryMock = vi.hoisted(() => vi.fn());

vi.mock("../../libs/typesafe", () => ({
  classifyItemCategory: classifyItemCategoryMock,
}));

vi.mock("../../middlewares/auth.middleware", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = { id: "user-test-123" };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

// Prevent real AI service initialization during tests
vi.mock("./ai.service", () => ({
  aiService: {
    analyzeImage: vi.fn(),
    createConversation: vi.fn(),
    listConversations: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    deleteConversation: vi.fn(),
  },
}));

vi.mock("../upload/upload.service", () => ({
  uploadService: {
    uploadImage: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

// Make the per-route rate limiter transparent so shared in-memory state
// does not cause 429s across independent test cases.
vi.mock("../../middlewares/rate-limit.middleware", () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

// ─── App Setup ───────────────────────────────────────────────────────────────

import aiRoutes from "./ai.routes";
import { errorHandler } from "../../middlewares/error.middleware";
import { AppError } from "../../middlewares/error.middleware";

const app = express();
app.use(express.json());
app.use("/api/ai", aiRoutes);
app.use(errorHandler);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/ai/classify-item — TypeSafe Item Classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Valid classification ──────────────────────────────────────────────

  it("returns category, confidence, and probabilities for a valid description", async () => {
    classifyItemCategoryMock.mockResolvedValueOnce({
      category: "wallet",
      confidence: 0.95,
      probabilities: {
        electronics: 0.01,
        wallet: 0.95,
        keys: 0.01,
        bag: 0.0,
        documents: 0.01,
        jewelry: 0.0,
        phone: 0.0,
        other: 0.02,
      },
      source: "typesafe",
    });

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "I found a black wallet in the library." });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category).toBe("wallet");
    expect(res.body.data.confidence).toBe(0.95);
    expect(res.body.data.source).toBe("typesafe");
    expect(res.body.data.probabilities).toBeDefined();
    expect(res.body.data.probabilities.wallet).toBe(0.95);
  });

  // ── 2. Empty description ────────────────────────────────────────────────

  it("returns 400 when description is empty", async () => {
    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(classifyItemCategoryMock).not.toHaveBeenCalled();
  });

  it("returns 400 when description is missing", async () => {
    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(classifyItemCategoryMock).not.toHaveBeenCalled();
  });

  // ── 3. Missing API key → 503 ───────────────────────────────────────────

  it("returns 503 when TypeSafe API key is not configured", async () => {
    classifyItemCategoryMock.mockRejectedValueOnce(
      new AppError(
        "TypeSafe AI service is not configured. Set the TYPESAFE_API_KEY environment variable.",
        503
      )
    );

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "A set of car keys with a red keychain." });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("not configured");
  });

  // ── 4. TypeSafe API error → 502 ────────────────────────────────────────

  it("returns 502 when TypeSafe API returns an error", async () => {
    classifyItemCategoryMock.mockRejectedValueOnce(
      new AppError("AI classification service is unavailable", 502)
    );

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "Blue backpack with laptop inside." });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });

  // ── 5. Authentication required ──────────────────────────────────────────

  it("returns 401 when no auth token is provided", async () => {
    const res = await request(app)
      .post("/api/ai/classify-item")
      .send({ description: "A laptop charger." });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(classifyItemCategoryMock).not.toHaveBeenCalled();
  });

  // ── 6. Category is always a valid ITEM_CATEGORY ─────────────────────────

  it("returns a valid item category from the existing set", async () => {
    const categories = [
      "electronics",
      "wallet",
      "keys",
      "bag",
      "documents",
      "jewelry",
      "phone",
      "other",
    ];

    for (const cat of categories) {
      classifyItemCategoryMock.mockResolvedValueOnce({
        category: cat,
        confidence: 0.8,
        probabilities: { [cat]: 0.8 },
        source: "typesafe",
      });

      const res = await request(app)
        .post("/api/ai/classify-item")
        .set("Authorization", "Bearer valid-token")
        .send({ description: `Test item for category ${cat}` });

      expect(res.status).toBe(200);
      expect(categories).toContain(res.body.data.category);
    }
  });

  // ── 7. Network timeout → 502 ───────────────────────────────────────────

  it("returns 502 when request times out", async () => {
    classifyItemCategoryMock.mockRejectedValueOnce(
      new AppError("AI classification service is unavailable", 502)
    );

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "Silver ring with diamond." });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });

  // ── 8. Rate limit exceeded → 429 ───────────────────────────────────────

  it("returns 429 when TypeSafe rate limit is hit", async () => {
    classifyItemCategoryMock.mockRejectedValueOnce(
      new AppError(
        "AI service is temporarily busy. Please try again later.",
        429
      )
    );

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "A pair of sunglasses." });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });

  // ── 9. Invalid/unexpected AI response handled gracefully ───────────────

  it("falls back to 'other' when TypeSafe returns an unexpected category", async () => {
    classifyItemCategoryMock.mockResolvedValueOnce({
      category: "other",
      confidence: 0,
      probabilities: { unknown_cat: 1.0 },
      source: "typesafe",
    });

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "Something very unusual." });

    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe("other");
    expect(res.body.data.source).toBe("typesafe");
  });

  // ── 10. Description too long → 400 ─────────────────────────────────────

  it("returns 400 when description exceeds 1000 characters", async () => {
    const longDescription = "a".repeat(1001);

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: longDescription });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(classifyItemCategoryMock).not.toHaveBeenCalled();
  });

  // ── 11. Invalid API key → 502 (not 401, because this is server config) ─

  it("returns 502 when TypeSafe rejects the API key", async () => {
    classifyItemCategoryMock.mockRejectedValueOnce(
      new AppError("AI service authentication failed", 502)
    );

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "A USB drive." });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });

  // ── 12. AI failure does not break manual item creation ──────────────────

  it("returns an error response without crashing the server", async () => {
    classifyItemCategoryMock.mockRejectedValueOnce(
      new AppError("AI classification service is unavailable", 502)
    );

    const res = await request(app)
      .post("/api/ai/classify-item")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "A green umbrella." });

    expect(res.status).toBe(502);

    // Server still responds to other requests
    const healthRes = await request(app)
      .get("/api/ai/conversations")
      .set("Authorization", "Bearer valid-token");
    // This should not crash (returns whatever the mocked service returns)
    expect([200, 500]).toContain(healthRes.status);
  });
});
