import { z } from "zod";

/**
 * Items Module Validation Schemas
 */

export const createItemSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    category: z.string().min(1, "Category is required"),
    description: z.string().max(500).optional(),
    lostMessage: z.string().max(500).optional(),
  }),
});

export const updateItemStatusSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, "Item ID is required"),
  }),
  body: z.object({
    status: z.enum(["safe", "lost"]),
    lostMessage: z.string().max(500).optional(),
  }),
});

export const getItemSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, "Item ID is required"),
  }),
  query: z.object({
    token: z.string().optional(),
  }),
});
