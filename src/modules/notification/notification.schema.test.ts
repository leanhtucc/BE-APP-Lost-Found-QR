import { describe, expect, it } from "vitest";
import {
  listNotificationsSchema,
  registerUserDeviceSchema,
  updatePreferenceSchema,
} from "./notification.schema";

describe("profile notification contracts", () => {
  it("applies notification pagination defaults and status normalization", () => {
    const parsed = listNotificationsSchema.parse({
      query: { status: "un_view" },
    });

    expect(parsed.query).toEqual({
      page: 1,
      per_page: 10,
      status: "UN_VIEW",
    });
  });

  it("caps notification page size at 50", () => {
    const parsed = listNotificationsSchema.parse({
      query: { page: "2", per_page: "500" },
    });
    expect(parsed.query).toMatchObject({ page: 2, per_page: 50 });
  });
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

  it("normalizes the FCM device contract to the internal fields", () => {
    const parsed = registerUserDeviceSchema.parse({
      body: {
        device_id: "android-8c733127",
        platform: "android",
        fcm_token: "firebase-registration-token",
        device_name: "OPPO CPH2591",
        app_version: "1.0.0",
      },
    });

    expect(parsed.body).toEqual({
      deviceId: "android-8c733127",
      platform: "android",
      token: "firebase-registration-token",
      deviceName: "OPPO CPH2591",
      appVersion: "1.0.0",
    });
  });
});
