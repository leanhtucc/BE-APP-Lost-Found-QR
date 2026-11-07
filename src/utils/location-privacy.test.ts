import { describe, expect, it } from "vitest";
import {
  blurAddress,
  blurCoordinate,
  blurReportLocation,
} from "./location-privacy";

describe("location privacy helpers", () => {
  it("snaps coordinates to a ~110 m grid", () => {
    expect(blurCoordinate(10.776889)).toBe(10.777);
    expect(blurCoordinate(106.700981)).toBe(106.701);
  });

  it("removes the street-level part of a formatted address", () => {
    expect(blurAddress("12 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM")).toBe(
      "Bến Nghé, Quận 1, TP.HCM"
    );
  });

  it("never echoes raw coordinates typed as an address", () => {
    expect(blurAddress("10.776889, 106.700981")).toBe("Khu vực lân cận");
  });

  it("keeps an address that has no street number", () => {
    expect(blurAddress("Công viên Tao Đàn")).toBe("Công viên Tao Đàn");
  });

  it("blurs every location field of a report", () => {
    const blurred = blurReportLocation({
      id: "r1",
      lat: 10.776889,
      lng: 106.700981,
      address: "12 Nguyễn Huệ, Bến Nghé, Quận 1",
    });
    expect(blurred).toEqual({
      id: "r1",
      lat: 10.777,
      lng: 106.701,
      address: "Bến Nghé, Quận 1",
    });
  });
});
