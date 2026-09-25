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

  it("accepts valid captureLocation and coordinates in updateItemSchema including 0,0", () => {
    const parsed = updateItemSchema.parse({
      body: {
        name: "Laptop cá nhân",
        captureLocation: {
          latitude: 0,
          longitude: 0,
          address: "Tòa nhà Landmark",
          accuracyMeters: 5,
        },
      },
    });

    expect(parsed.body.captureLocation).toEqual({
      latitude: 0,
      longitude: 0,
      address: "Tòa nhà Landmark",
      accuracyMeters: 5,
    });
  });

  it("rejects out-of-bounds or non-finite coordinates in updateItemSchema", () => {
    expect(
      updateItemSchema.safeParse({
        body: {
          captureLocation: {
            latitude: 91,
            longitude: 106.7009,
          },
        },
      }).success
    ).toBe(false);

    expect(
      updateItemSchema.safeParse({
        body: {
          captureLocation: {
            latitude: 10.7769,
            longitude: 181,
          },
        },
      }).success
    ).toBe(false);

    expect(
      updateItemSchema.safeParse({
        body: {
          latitude: 10.7769,
          // Missing longitude
        },
      }).success
    ).toBe(false);
  });

  it("accepts captureLocation: null to clear saved location in updateItemSchema", () => {
    const parsed = updateItemSchema.parse({
      body: {
        name: "Laptop cá nhân",
        captureLocation: null,
      },
    });

    expect(parsed.body.captureLocation).toBeNull();
  });

  it("allows omitting captureLocation entirely in updateItemSchema", () => {
    const parsed = updateItemSchema.parse({
      body: {
        name: "Laptop cá nhân đổi tên",
      },
    });

    expect(parsed.body.captureLocation).toBeUndefined();
  });
});
