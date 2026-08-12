import { describe, expect, it } from "vitest";
import { activeUsersSchema, nearbySchema } from "./map.schema";

describe("map query validation", () => {
  it("coerces query strings and applies nearby defaults", () => {
    const result = nearbySchema.parse({
      query: { lat: "21.0285", lng: "105.8542" },
    });

    expect(result.query).toEqual({
      lat: 21.0285,
      lng: 105.8542,
      radius: 5000,
      limit: 100,
    });
  });

  it("rejects invalid coordinates and excessive result limits", () => {
    expect(() =>
      nearbySchema.parse({
        query: { lat: "91", lng: "105", limit: "101" },
      })
    ).toThrow();
  });

  it("uses a two-kilometre default for active users", () => {
    const result = activeUsersSchema.parse({
      query: { lat: "21", lng: "105" },
    });

    expect(result.query.radius).toBe(2000);
  });
});
