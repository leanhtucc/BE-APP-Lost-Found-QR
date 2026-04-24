import { z } from "zod";

// POST /v1/radar/simulate
export const radarSimulateSchema = z.object({
  body: z.object({
    lat: z
      .number({ required_error: "lat is required" })
      .min(-90)
      .max(90),
    lng: z
      .number({ required_error: "lng is required" })
      .min(-180)
      .max(180),
    radius: z
      .number()
      .int()
      .min(100, "radius must be at least 100m")
      .max(5000, "radius cannot exceed 5000m")
      .default(500),
  }),
});
