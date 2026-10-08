import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  sessionFindUnique: vi.fn(),
}));

vi.mock("../libs/prisma", () => ({
  prisma: {
    user: { findUnique: prismaMocks.userFindUnique },
    returnSession: { findUnique: prismaMocks.sessionFindUnique },
  },
}));

vi.mock("../libs/supabase-auth", () => ({
  authenticateAccessToken: vi.fn().mockResolvedValue(null),
}));

import { issueGuestToken } from "../libs/guest-jwt";
import { guestOrUserAuth, requireGuestAuth } from "./guest-auth.middleware";

const app = express();
app.get("/returns/:id", guestOrUserAuth, (_req, res) =>
  res.json({ success: true })
);
app.post("/guest/refresh", requireGuestAuth, (_req, res) =>
  res.json({ success: true })
);

describe("guest token authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.userFindUnique.mockResolvedValue({
      id: "guest-a",
      role: "guest",
      scheduledDeletionAt: null,
    });
    prismaMocks.sessionFindUnique.mockResolvedValue({
      id: "return-a",
      finderId: "guest-a",
      status: "CHAT_ACTIVE",
    });
  });

  it("allows only the guest's bound return session", async () => {
    const token = issueGuestToken("guest-a", "return-a").token;
    expect(
      (
        await request(app)
          .get("/returns/return-a")
          .set("Authorization", `Bearer ${token}`)
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .get("/returns/return-b")
          .set("Authorization", `Bearer ${token}`)
      ).status
    ).toBe(403);
  });

  it("rejects deleted or non-guest accounts and completed sessions", async () => {
    const token = issueGuestToken("guest-a", "return-a").token;
    prismaMocks.userFindUnique.mockResolvedValueOnce(null);
    expect(
      (
        await request(app)
          .post("/guest/refresh")
          .set("Authorization", `Bearer ${token}`)
      ).status
    ).toBe(401);
    prismaMocks.userFindUnique.mockResolvedValueOnce({
      id: "guest-a",
      role: "guest",
      scheduledDeletionAt: null,
    });
    prismaMocks.sessionFindUnique.mockResolvedValueOnce({
      id: "return-a",
      finderId: "guest-a",
      status: "COMPLETED",
    });
    expect(
      (
        await request(app)
          .post("/guest/refresh")
          .set("Authorization", `Bearer ${token}`)
      ).status
    ).toBe(403);
  });

  it("rejects tokens older than the absolute guest lifetime", async () => {
    const oldIssuedAt = Math.floor(Date.now() / 1000) - 73 * 60 * 60;
    const token = issueGuestToken("guest-a", "return-a", oldIssuedAt).token;
    expect(
      (
        await request(app)
          .post("/guest/refresh")
          .set("Authorization", `Bearer ${token}`)
      ).status
    ).toBe(401);
  });
});
