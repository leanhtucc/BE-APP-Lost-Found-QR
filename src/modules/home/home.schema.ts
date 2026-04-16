import { z } from "zod";

/**
 * Validation schema for GET /api/home/lost-feed
 * lat/lng are optional – when omitted, only myOwn items are returned (no nearby).
 */
export const lostFeedSchema = z.object({
  query: z
    .object({
      lat: z.coerce.number().min(-90).max(90).optional(),
      lng: z.coerce.number().min(-180).max(180).optional(),
      radius: z.coerce.number().min(100).max(50000).default(5000).optional(),
    })
    .refine(
      (q) => {
        const hasLat = q.lat !== undefined;
        const hasLng = q.lng !== undefined;
        return hasLat === hasLng; // both present or both absent
      },
      { message: "lat and lng must both be provided together" }
    ),
});
