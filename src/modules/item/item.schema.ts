import { z } from "zod";
import { ITEM_CATEGORIES } from "./item.types";

/**
 * Item Validation Schemas
 * Zod schemas để validate request data
 */

// Schema cho tạo item mới
export const createItemSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: "Name is required" })
        .trim()
        .min(1, "Name is required")
        .max(100, "Name must be less than 100 characters"),
      category: z.enum(ITEM_CATEGORIES, {
        errorMap: () => ({ message: "Invalid category" }),
      }),
      description: z
        .string()
        .max(500, "Description must be less than 500 characters")
        .optional(),
      imagePublicUrl: z
        .string({ required_error: "Image URL is required" })
        .trim()
        .min(1, "Image URL is required")
        .url("Invalid image URL"),
      hasInsurance: z.boolean().optional().default(false),
      details: z.any().optional(), // JSONB cho color, storage, serial...
      captureLocation: z
        .object({
          latitude: z.coerce.number().finite().min(-90).max(90),
          longitude: z.coerce.number().finite().min(-180).max(180),
          address: z.string().max(500).optional().nullable(),
          accuracyMeters: z.coerce
            .number()
            .finite()
            .nonnegative()
            .optional()
            .nullable(),
          capturedAt: z.union([z.string(), z.date()]).optional().nullable(),
        })
        .optional()
        .nullable(),
      latitude: z.coerce.number().finite().min(-90).max(90).optional(),
      longitude: z.coerce.number().finite().min(-180).max(180).optional(),
      address: z.string().max(255).optional(),
      lastSeenLocation: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const hasFlatLat = data.latitude !== undefined;
      const hasFlatLng = data.longitude !== undefined;
      if (hasFlatLat !== hasFlatLng) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "latitude and longitude must be provided together",
          path: ["latitude"],
        });
      }
    }),
});

// Schema cho cập nhật item
export const updateItemSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(1, "Name is required")
        .max(100, "Name must be less than 100 characters")
        .optional(),
      category: z.enum(ITEM_CATEGORIES).optional(),
      description: z
        .string()
        .max(500, "Description must be less than 500 characters")
        .optional()
        .or(z.literal("")),
      imagePublicUrl: z
        .string()
        .url("Invalid image URL")
        .optional()
        .or(z.literal("")),
      hasInsurance: z.boolean().optional(),
      details: z.any().optional(),
      captureLocation: z
        .object({
          latitude: z.coerce.number().finite().min(-90).max(90),
          longitude: z.coerce.number().finite().min(-180).max(180),
          address: z.string().max(500).optional().nullable(),
          accuracyMeters: z.coerce
            .number()
            .finite()
            .nonnegative()
            .optional()
            .nullable(),
          capturedAt: z.union([z.string(), z.date()]).optional().nullable(),
        })
        .optional()
        .nullable(),
      latitude: z.coerce
        .number()
        .finite()
        .min(-90)
        .max(90)
        .optional()
        .nullable(),
      longitude: z.coerce
        .number()
        .finite()
        .min(-180)
        .max(180)
        .optional()
        .nullable(),
      address: z.string().max(255).optional().nullable(),
      lastSeenLocation: z.string().max(500).optional().nullable(),
    })
    .superRefine((data, ctx) => {
      const hasFlatLat = data.latitude !== undefined && data.latitude !== null;
      const hasFlatLng =
        data.longitude !== undefined && data.longitude !== null;
      if (hasFlatLat !== hasFlatLng) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "latitude and longitude must be provided together",
          path: ["latitude"],
        });
      }
    }),
});

// Schema cho update status
export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(["SAFE", "LOST"], {
      required_error: "Status is required",
    }),
    lostMessage: z
      .string()
      .max(500, "Lost message must be less than 500 characters")
      .optional()
      .or(z.literal("")),
    lostAddress: z.string().trim().max(300).optional().or(z.literal("")),
    latitude: z.coerce.number().finite().min(-90).max(90).optional(),
    longitude: z.coerce.number().finite().min(-180).max(180).optional(),
  }),
});

export const updateStatusSchemaWithCoordinates = updateStatusSchema.refine(
  (payload) => {
    const { latitude, longitude } = payload.body;
    const hasLatitude = latitude !== undefined;
    const hasLongitude = longitude !== undefined;

    return hasLatitude === hasLongitude;
  },
  {
    message: "latitude and longitude must be provided together",
    path: ["body", "latitude"],
  }
);

export const initGuestChatSchema = z.object({
  body: z
    .object({
      itemId: z.string().trim().min(1, "Item ID is required"),
      phoneNumber: z
        .string()
        .trim()
        .regex(/^\+?[0-9]{9,15}$/, "Phone number is invalid"),
      lat: z.coerce.number().finite().min(-90).max(90).optional(),
      lng: z.coerce.number().finite().min(-180).max(180).optional(),
    })
    .superRefine((value, ctx) => {
      if ((value.lat === undefined) !== (value.lng === undefined)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "lat and lng must be provided together",
          path: ["lat"],
        });
      }
    }),
});

// Schema cho list items
export const listItemsSchema = z.object({
  query: z.object({
    status: z
      .string()
      .transform((val) => val.toUpperCase())
      .pipe(z.enum(["SAFE", "LOST", "FOUND", "RESOLVED", "ALL"]))
      .optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

// Schema cho scan QR (itemId trong params)
export const scanQRSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, "Item ID is required"),
  }),
});

// Schema cho get/update/delete item (id trong params)
export const itemIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Item ID is required"),
  }),
});

// Schema cho search items
export const searchItemsSchema = z.object({
  query: z.object({
    q: z
      .string()
      .min(1, "Search query is required")
      .max(100, "Search query must be less than 100 characters"),
    status: z
      .string()
      .transform((val) => val.toUpperCase())
      .pipe(z.enum(["SAFE", "LOST", "FOUND", "RESOLVED", "ALL"]))
      .optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});
