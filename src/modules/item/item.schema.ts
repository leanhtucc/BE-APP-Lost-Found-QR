import { z } from "zod";
import { ITEM_CATEGORIES } from "./item.types";

/**
 * Item Validation Schemas
 * Zod schemas để validate request data
 */

// Schema cho tạo item mới
export const createItemSchema = z.object({
  query: z.object({
    name: z
      .string()
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
      .string()
      .url("Invalid image URL")
      .optional()
      .or(z.literal("")),
    lastSeenLocation: z
      .string()
      .refine(
        (val) => {
          if (!val) return true;
          try {
            const parsed = JSON.parse(val);
            return (
              typeof parsed.lat === "number" && typeof parsed.lng === "number"
            );
          } catch {
            return false;
          }
        },
        { message: "lastSeenLocation must be valid JSON with lat and lng" }
      )
      .optional(),
    securityPin: z
      .string()
      .regex(/^\d{4}$/, "Security PIN must be 4 digits")
      .optional()
      .or(z.literal("")),
  }),
});

// Schema cho cập nhật item
export const updateItemSchema = z.object({
  query: z.object({
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
    status: z.enum(["safe", "lost"]).optional(),
    lostMessage: z
      .string()
      .max(500, "Lost message must be less than 500 characters")
      .optional()
      .or(z.literal("")),
    imagePublicUrl: z
      .string()
      .url("Invalid image URL")
      .optional()
      .or(z.literal("")),
    lastSeenLocation: z
      .string()
      .refine(
        (val) => {
          if (!val) return true;
          try {
            const parsed = JSON.parse(val);
            return (
              typeof parsed.lat === "number" && typeof parsed.lng === "number"
            );
          } catch {
            return false;
          }
        },
        { message: "lastSeenLocation must be valid JSON with lat and lng" }
      )
      .optional()
      .or(z.literal("")),
    securityPin: z
      .string()
      .regex(/^\d{4}$/, "Security PIN must be 4 digits")
      .optional()
      .or(z.literal("")),
  }),
});

// Schema cho update status
export const updateStatusSchema = z.object({
  query: z.object({
    status: z.enum(["safe", "lost"], {
      required_error: "Status is required",
    }),
    lostMessage: z
      .string()
      .max(500, "Lost message must be less than 500 characters")
      .optional()
      .or(z.literal("")),
  }),
});

// Schema cho list items
export const listItemsSchema = z.object({
  query: z.object({
    status: z.enum(["safe", "lost", "all"]).optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10)),
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
    status: z.enum(["safe", "lost", "all"]).optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10)),
  }),
});
