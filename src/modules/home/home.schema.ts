import { z } from "zod";
import { HOME_LOST_RADIUS_METERS } from "../../utils/constants";
import { ITEM_CATEGORIES } from "../item/item.types";

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

function parseRequiredQueryNumber(field: string, range: NumberRange = {}) {
  return parseOptionalQueryNumber(field, range).refine(
    (value): value is number => value !== undefined,
    { message: `${field} is required` }
  );
}

/**
 * Validation schema for GET /api/home/lost-feed
 * Home is location-bound. Missing coordinates must never fall back to a global
 * feed. Radius is accepted for backwards compatibility but capped server-side.
 */
export const lostFeedSchema = z.object({
  query: z.object({
    lat: parseRequiredQueryNumber("lat", { min: -90, max: 90 }),
    lng: parseRequiredQueryNumber("lng", { min: -180, max: 180 }),
    radius: parseOptionalQueryNumber("radius", { min: 1 }).transform((value) =>
      Math.min(value ?? HOME_LOST_RADIUS_METERS, HOME_LOST_RADIUS_METERS)
    ),
    category: z
      .string()
      .trim()
      .optional()
      .transform((val) =>
        val && val.toLowerCase() !== "all" ? val : undefined
      )
      .refine(
        (val) =>
          val === undefined ||
          (ITEM_CATEGORIES as readonly string[]).includes(val),
        { message: "Invalid category" }
      ),
  }),
});
