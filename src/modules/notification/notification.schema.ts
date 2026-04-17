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

export const listNotificationsSchema = z.object({
  query: z.object({
    category: z
      .preprocess(parseOptionalCategory, z.enum(NOTIFICATION_CATEGORIES).optional())
      .optional(),
    page: z.preprocess((value) => parsePositiveInt(value, 1, 100000), z.number()),
    limit: z.preprocess((value) => parsePositiveInt(value, 20, 100), z.number()),
  }),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Notification ID is required"),
  }),
});
