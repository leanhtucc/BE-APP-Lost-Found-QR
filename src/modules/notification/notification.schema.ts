import { z } from "zod";

const NOTIFICATION_CATEGORIES = [
  "IMPORTANT",
  "TRANSACTION",
  "ITEM",
  "SOCIAL",
] as const;

function parseOptionalCategory(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;

  const normalized = String(value).trim().toUpperCase();
  return normalized || undefined;
}

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
    category: z
      .preprocess(
        parseOptionalCategory,
        z.enum(NOTIFICATION_CATEGORIES).optional()
      )
      .optional(),
    page: z.preprocess(
      (value) => parsePositiveInt(value, 1, 100000),
      z.number()
    ),
    limit: z.preprocess(
      (value) => parsePositiveInt(value, 20, 100),
      z.number()
    ),
  }),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Notification ID is required"),
  }),
});

export const updatePreferenceSchema = z.object({
  body: z.object({
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
    quietStart: z.string().regex(timeRegex, "quietStart must be in HH:mm format (e.g. 22:00)").optional(),
    quietEnd: z.string().regex(timeRegex, "quietEnd must be in HH:mm format (e.g. 07:00)").optional(),
    timezone: z.string().min(1).optional(),
    dailyDigestTime: z.string().regex(timeRegex, "dailyDigestTime must be in HH:mm format (e.g. 19:30)").optional(),
    nearbyRadius: z.number().int().min(100).max(5000).optional(),
  }).strict().refine(
    (body) => Object.keys(body).length > 0,
    "At least one preference field is required"
  ),
});

export const registerDeviceSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, "Push token is required").optional(),
      pushToken: z.string().min(1, "Push token is required").optional(),
      platform: z.enum(["android", "ios", "web"]).default("android"),
      deviceId: z.string().trim().min(1, "Device ID is required").max(255),
      appVersion: z.string().trim().max(50).optional(),
    })
    .strict()
    .superRefine((body, ctx) => {
      if (!body.pushToken && !body.token) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pushToken"],
          message: "Push token is required",
        });
      }
    })
    .transform((body) => ({
      token: body.pushToken || body.token!,
      platform: body.platform,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
    })),
});

export const unregisterDeviceSchema = z.object({
  params: z.object({
    deviceId: z.string().min(1, "Device ID is required"),
  }),
});

export const markOpenedSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Notification ID is required"),
  }),
});
