import { z } from "zod";

function isFiniteNumber(value: string): boolean {
  const numberValue = Number(value);
  return Number.isFinite(numberValue);
}

export const nearbyMapSchema = z.object({
  query: z.object({
    lat: z
      .string()
      .refine(isFiniteNumber, { message: "lat must be a valid number" })
      .refine((value) => Number(value) >= -90 && Number(value) <= 90, {
        message: "lat must be in range [-90, 90]",
      }),
    lng: z
      .string()
      .refine(isFiniteNumber, { message: "lng must be a valid number" })
      .refine((value) => Number(value) >= -180 && Number(value) <= 180, {
        message: "lng must be in range [-180, 180]",
      }),
    radius: z
      .string()
      .optional()
      .refine((value) => value === undefined || isFiniteNumber(value), {
        message: "radius must be a valid number",
      })
      .refine(
        (value) => {
          if (value === undefined) {
            return true;
          }

          const meters = Number(value);
          return meters >= 100 && meters <= 20000;
        },
        {
          message: "radius must be in range [100, 20000] meters",
        }
      ),
    limit: z
      .string()
      .optional()
      .refine((value) => value === undefined || isFiniteNumber(value), {
        message: "limit must be a valid number",
      })
      .refine(
        (value) => {
          if (value === undefined) {
            return true;
          }

          const parsed = Number(value);
          return parsed >= 1 && parsed <= 200;
        },
        {
          message: "limit must be in range [1, 200]",
        }
      ),
  }),
});
