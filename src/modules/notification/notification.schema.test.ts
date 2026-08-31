import { describe, expect, it } from "vitest";
import {
  registerDeviceSchema,
  updatePreferenceSchema,
} from "./notification.schema";

describe("profile notification contracts", () => {
  it("accepts a partial preference update within the supported radius", () => {
    const parsed = updatePreferenceSchema.parse({
      body: {
        pushEnabled: false,
        emailEnabled: true,
        proximityEnabled: true,
        notificationRadiusMeters: 1000,
        language: "vi",
      },
    });

    expect(parsed.body.notificationRadiusMeters).toBe(1000);
  });

  it("rejects notification radii outside 100 to 5000 metres", () => {
    expect(
      updatePreferenceSchema.safeParse({
        body: { notificationRadiusMeters: 99 },
      }).success
    ).toBe(false);
    expect(
      updatePreferenceSchema.safeParse({
        body: { notificationRadiusMeters: 5001 },
      }).success
    ).toBe(false);
  });

  it("normalizes the new pushToken device contract to the internal token field", () => {
    const parsed = registerDeviceSchema.parse({
      body: {
        deviceId: "android-8c733127",
        platform: "android",
        pushToken: "ExponentPushToken[xxxxxxxxxxxxxxxx]",
        appVersion: "1.0.0",
      },
    });

    expect(parsed.body).toEqual({
      deviceId: "android-8c733127",
      platform: "android",
      token: "ExponentPushToken[xxxxxxxxxxxxxxxx]",
      appVersion: "1.0.0",
    });
  });
});
