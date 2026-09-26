import { z } from "zod";

function parsePositiveInt(
  value: unknown,
  defaultValue: number,
  maxValue: number
): number {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return Number.NaN;
  }

  return Math.min(parsed, maxValue);
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.preprocess(
      (value) => parsePositiveInt(value, 1, 100000),
      z.number()
    ),
    per_page: z.preprocess(
      (value) => parsePositiveInt(value, 10, 50),
      z.number()
    ),
    status: z.preprocess(
      (value) =>
        value === undefined || value === null || value === ""
          ? undefined
          : String(value).toUpperCase(),
      z.enum(["VIEW", "UN_VIEW"]).optional()
    ),
  }),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Notification ID is required"),
  }),
});

export const updatePreferenceSchema = z.object({
  body: z
    .object({
      pushEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional(),
      proximityEnabled: z.boolean().optional(),
      notificationRadiusMeters: z.number().int().min(100).max(5000).optional(),
      language: z.enum(["vi", "en"]).optional(),
      importantEnabled: z.boolean().optional(),
      transactionEnabled: z.boolean().optional(),
      itemEnabled: z.boolean().optional(),
      socialEnabled: z.boolean().optional(),
      dailyDigestEnabled: z.boolean().optional(),
      nearbyAlertsEnabled: z.boolean().optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietStart: z
        .string()
        .regex(timeRegex, "quietStart must be in HH:mm format (e.g. 22:00)")
        .optional(),
      quietEnd: z
        .string()
        .regex(timeRegex, "quietEnd must be in HH:mm format (e.g. 07:00)")
        .optional(),
      timezone: z.string().min(1).optional(),
      dailyDigestTime: z
        .string()
        .regex(
          timeRegex,
          "dailyDigestTime must be in HH:mm format (e.g. 19:30)"
        )
        .optional(),
      nearbyRadius: z.number().int().min(100).max(5000).optional(),
    })
    .strict()
    .refine(
      (body) => Object.keys(body).length > 0,
      "At least one preference field is required"
    ),
});

export const registerUserDeviceSchema = z.object({
  body: z
    .object({
      fcm_token: z.string().trim().min(1, "FCM token is required"),
      platform: z.enum(["android", "ios"]),
      device_id: z.string().trim().min(1).max(255).optional(),
      device_name: z.string().trim().max(255).optional(),
      app_version: z.string().trim().max(50).optional(),
    })
    .strict()
    .transform((body) => ({
      token: body.fcm_token,
      platform: body.platform,
      deviceId: body.device_id,
      deviceName: body.device_name,
      appVersion: body.app_version,
    })),
});

export const deleteUserDeviceSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Device ID is required"),
  }),
});

export const markOpenedSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Notification ID is required"),
  }),
});
