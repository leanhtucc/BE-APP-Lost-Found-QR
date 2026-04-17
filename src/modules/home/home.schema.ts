import { z } from "zod";

/**
 * Validation schema for GET /api/home/lost-feed
 * lat/lng are optional – when omitted, only myOwn items are returned (no nearby).
 */
export const lostFeedSchema = z.object({
  query: z
    .object({
      lat: z.string().optional().refine(val => val === undefined || val === "" || (!isNaN(Number(val)) && Number(val) >= -90 && Number(val) <= 90)),
      lng: z.string().optional().refine(val => val === undefined || val === "" || (!isNaN(Number(val)) && Number(val) >= -180 && Number(val) <= 180)),
      radius: z.string().optional().refine(val => val === undefined || val === "" || (!isNaN(Number(val)))),
    })
    .refine(
      (q) => {
        const hasLat = q.lat !== undefined && q.lat !== "";
        const hasLng = q.lng !== undefined && q.lng !== "";
        return hasLat === hasLng; // both present or both absent
      },
      { message: "lat and lng must both be provided together" }
    ),
});
