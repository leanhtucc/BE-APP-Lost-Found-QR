import { z } from "zod";

export const nearbySchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(100).max(50000).default(5000),
  }),
});

export const activeUsersSchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(100).max(50000).default(2000),
  }),
});
