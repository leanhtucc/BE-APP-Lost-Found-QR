import { describe, expect, it } from "vitest";
import {
  confirmHandoverSchema,
  createOrGetSessionSchema,
  disputeHandoverSchema,
  proposeMeetupSchema,
  submitRatingSchema,
} from "./return.schema";

describe("Return Flow Schemas", () => {
  describe("createOrGetSessionSchema", () => {
    it("accepts valid channelId and itemId", () => {
      const result = createOrGetSessionSchema.safeParse({
        body: {
          channelId: "item_123_456",
          itemId: "123",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty channelId", () => {
      const result = createOrGetSessionSchema.safeParse({
        body: {
          channelId: "",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("proposeMeetupSchema", () => {
    it("accepts valid proposal payload", () => {
      const result = proposeMeetupSchema.safeParse({
        body: {
          address: "123 Đường Lê Lợi, Quận 1, TP.HCM",
          name: "Cafe Highlands",
          latitude: 10.7769,
          longitude: 106.7009,
          scheduledTime: "2026-09-05T15:00:00Z",
          notes: "Gặp ở bàn ngoài trời",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid latitude or longitude", () => {
      const result = proposeMeetupSchema.safeParse({
        body: {
          address: "Somewhere",
          latitude: 95, // invalid > 90
          longitude: 106.7009,
          scheduledTime: "2026-09-05T15:00:00Z",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing scheduledTime", () => {
      const result = proposeMeetupSchema.safeParse({
        body: {
          address: "Somewhere",
          latitude: 10.7769,
          longitude: 106.7009,
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("confirmHandoverSchema", () => {
    it("accepts 6-digit code", () => {
      const result = confirmHandoverSchema.safeParse({
        body: {
          code: "852963",
          idempotencyKey: "idemp_123",
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty or omitted code", () => {
      const result = confirmHandoverSchema.safeParse({
        body: {
          idempotencyKey: "idemp_123",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-6-digit code", () => {
      const result = confirmHandoverSchema.safeParse({
        body: {
          code: "12345", // only 5 digits
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("disputeHandoverSchema", () => {
    it("accepts valid dispute reason", () => {
      const result = disputeHandoverSchema.safeParse({
        body: {
          reason: "Người nhặt không mang đúng món đồ đã miêu tả",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects too short reason", () => {
      const result = disputeHandoverSchema.safeParse({
        body: {
          reason: "no",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("submitRatingSchema", () => {
    it("accepts valid rating", () => {
      const result = submitRatingSchema.safeParse({
        body: {
          score: 5,
          tags: ["Nhiệt tình", "Đúng giờ"],
          comment: "Cảm ơn bạn rất nhiều!",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.score).toBe(5);
        expect(result.data.body.tags).toEqual(["Nhiệt tình", "Đúng giờ"]);
      }
    });

    it("rejects score out of range", () => {
      const resultZero = submitRatingSchema.safeParse({
        body: { score: 0 },
      });
      expect(resultZero.success).toBe(false);

      const resultSix = submitRatingSchema.safeParse({
        body: { score: 6 },
      });
      expect(resultSix.success).toBe(false);
    });

    it("rejects non-integer score", () => {
      const result = submitRatingSchema.safeParse({
        body: { score: 4.5 },
      });
      expect(result.success).toBe(false);
    });
  });
});
