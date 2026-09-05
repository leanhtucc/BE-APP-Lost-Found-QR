import { describe, expect, it } from "vitest";
import {
  initGuestChatSchema,
  updateItemSchema,
  updateStatusSchemaWithCoordinates,
} from "./item.schema";

describe("item flow contracts", () => {
  it("accepts editable item fields from a JSON body", () => {
    const parsed = updateItemSchema.parse({
      body: {
        name: "Ví da màu nâu",
        hasInsurance: true,
        details: { color: "Nâu" },
      },
    });

    expect(parsed.body).toEqual({
      name: "Ví da màu nâu",
      hasInsurance: true,
      details: { color: "Nâu" },
    });
  });

  it("strips lifecycle fields from the general item edit endpoint", () => {
    const parsed = updateItemSchema.parse({
      body: { name: "Ví da", status: "FOUND", lostMessage: "invalid" },
    });

    expect(parsed.body).toEqual({ name: "Ví da" });
  });

  it("accepts SAFE to LOST request data from a JSON body", () => {
    const parsed = updateStatusSchemaWithCoordinates.parse({
      body: {
        status: "LOST",
        lostMessage: "Đánh rơi gần cổng trường",
        lostAddress: "Cổng trường Nguyễn Du",
        latitude: 10.7769,
        longitude: 106.7009,
      },
    });

    expect(parsed.body.status).toBe("LOST");
    expect(parsed.body.latitude).toBe(10.7769);
  });

  it("does not let clients assign lifecycle-only statuses", () => {
    expect(
      updateStatusSchemaWithCoordinates.safeParse({
        body: { status: "FOUND" },
      }).success
    ).toBe(false);
    expect(
      updateStatusSchemaWithCoordinates.safeParse({
        body: { status: "RESOLVED" },
      }).success
    ).toBe(false);
  });

  it("requires lost coordinates to be supplied as a pair", () => {
    expect(
      updateStatusSchemaWithCoordinates.safeParse({
        body: { status: "LOST", latitude: 10.7769 },
      }).success
    ).toBe(false);
  });

  it("validates finder contact and optional coordinates", () => {
    const parsed = initGuestChatSchema.parse({
      body: {
        itemId: "qr_123",
        phoneNumber: "+84901234567",
        lat: "10.7769",
        lng: "106.7009",
      },
    });

    expect(parsed.body.lat).toBe(10.7769);
    expect(parsed.body.lng).toBe(106.7009);
  });
});
