import { z } from "zod";

export const nearbySchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(100).max(50000).default(5000),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  }),
});

export const activeUsersSchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(100).max(50000).default(2000),
  }),
});

export const autocompleteSchema = z.object({
  query: z
    .object({
      input: z.string().min(1).optional(),
      q: z.string().min(1).optional(),
      query: z.string().min(1).optional(),
      lat: z.coerce.number().min(-90).max(90).optional(),
      lng: z.coerce.number().min(-180).max(180).optional(),
      radius: z.coerce.number().positive().optional(),
      sessiontoken: z.string().optional(),
    })
    .refine((data) => Boolean(data.input || data.q || data.query), {
      message: "input or q is required",
      path: ["input"],
    }),
});

export const placeDetailsSchema = z.object({
  query: z
    .object({
      place_id: z.string().min(1).optional(),
      placeId: z.string().min(1).optional(),
      sessiontoken: z.string().optional(),
    })
    .refine((data) => Boolean(data.place_id || data.placeId), {
      message: "place_id is required",
      path: ["place_id"],
    }),
});

export const reverseGeocodeSchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }),
});

export const geocodeSchema = z.object({
  query: z
    .object({
      address: z.string().min(1).optional(),
      q: z.string().min(1).optional(),
      query: z.string().min(1).optional(),
    })
    .refine((data) => Boolean(data.address || data.q || data.query), {
      message: "address is required",
      path: ["address"],
    }),
});
