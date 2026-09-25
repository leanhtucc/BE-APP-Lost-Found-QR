import { describe, expect, it } from "vitest";
import { HOME_LOST_RADIUS_METERS } from "../../utils/constants";
import { lostFeedSchema } from "./home.schema";

describe("Home lost-feed query contract", () => {
  it("requires both current coordinates", () => {
    expect(
      lostFeedSchema.safeParse({ query: { lng: "105.8342" } }).success
    ).toBe(false);
    expect(
      lostFeedSchema.safeParse({ query: { lat: "21.0278" } }).success
    ).toBe(false);
    expect(lostFeedSchema.safeParse({ query: {} }).success).toBe(false);
  });

  it("coerces valid query strings and defaults to the fixed Home radius", () => {
    const parsed = lostFeedSchema.parse({
      query: { lat: "21.0278", lng: "105.8342" },
    });

    expect(parsed.query).toEqual({
      lat: 21.0278,
      lng: 105.8342,
      radius: HOME_LOST_RADIUS_METERS,
    });
  });

  it("caps an excessive client radius at ten kilometres", () => {
    const parsed = lostFeedSchema.parse({
      query: { lat: "21.0278", lng: "105.8342", radius: "500000" },
    });

    expect(parsed.query.radius).toBe(HOME_LOST_RADIUS_METERS);
  });

  it.each([
    { lat: "91", lng: "105" },
    { lat: "-91", lng: "105" },
    { lat: "21", lng: "181" },
    { lat: "21", lng: "-181" },
    { lat: "NaN", lng: "105" },
    { lat: "21", lng: "105", radius: "0" },
    { lat: "21", lng: "105", category: "invalid_category" },
  ])("rejects invalid coordinates or radius: %o", (query) => {
    expect(lostFeedSchema.safeParse({ query }).success).toBe(false);
  });

  it("accepts valid category and transforms 'all' to undefined", () => {
    const withWallet = lostFeedSchema.parse({
      query: { lat: "21.0278", lng: "105.8342", category: "wallet" },
    });
    expect(withWallet.query.category).toBe("wallet");

    const withAll = lostFeedSchema.parse({
      query: { lat: "21.0278", lng: "105.8342", category: "all" },
    });
    expect(withAll.query.category).toBeUndefined();
  });
});
