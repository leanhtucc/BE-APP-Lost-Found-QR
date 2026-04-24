import { z } from "zod";

// POST /v1/reports – tạo báo mất Guardian
export const createReportSchema = z.object({
  body: z.object({
    item_id: z.string().min(1, "item_id is required"),
    location: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      address: z.string().optional(),
    }),
    radar: z.object({
      radius: z
        .number()
        .int()
        .min(100, "radius must be at least 100m")
        .max(5000, "radius cannot exceed 5000m"),
      duration_hours: z
        .number()
        .int()
        .min(1)
        .max(168, "duration cannot exceed 7 days"),
    }),
    reward: z.object({
      base_amount: z
        .number()
        .int()
        .min(10000, "Minimum reward is 10,000đ"),
      is_custom: z.boolean().default(false),
    }),
  }),
});

// POST /api/reports/webhook/payment
export const webhookPaymentSchema = z.object({
  body: z.object({
    post_id: z.string(),
    amount: z.number(),
    provider: z.string(),
    transaction_code: z.string(),
    status: z.string(),
  }),
});

// Keep legacy alias for backward‑compat (old route still uses this name)
export const reportLostItemSchema = createReportSchema;
