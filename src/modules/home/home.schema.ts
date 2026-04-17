import { z } from "zod";

type NumberRange = {
  min?: number;
  max?: number;
};

function parseOptionalQueryNumber(field: string, range: NumberRange = {}) {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null) return undefined;

      const normalized = String(value).trim();
      if (!normalized) return undefined;

      const lowered = normalized.toLowerCase();
      if (lowered === "null" || lowered === "undefined" || lowered === "nan") {
        return undefined;
      }

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((value) => value === undefined || Number.isFinite(value), {
      message: `${field} must be a valid number`,
    })
    .refine(
      (value) => {
        if (value === undefined) return true;
        if (range.min !== undefined && value < range.min) return false;
        if (range.max !== undefined && value > range.max) return false;
        return true;
      },
      {
        message:
          range.min !== undefined && range.max !== undefined
            ? `${field} must be between ${range.min} and ${range.max}`
            : `${field} is out of range`,
      }
    );
}

/**
 * Validation schema for GET /api/home/lost-feed
 * lat/lng are optional – when omitted, only myOwn items are returned (no nearby).
 */
export const lostFeedSchema = z.object({
  query: z.object({
    lat: parseOptionalQueryNumber("lat", { min: -90, max: 90 }),
    lng: parseOptionalQueryNumber("lng", { min: -180, max: 180 }),
    radius: parseOptionalQueryNumber("radius", { min: 1 }),
  }),
});
