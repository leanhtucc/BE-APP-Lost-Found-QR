import { z } from "zod";

export const reportLostItemSchema = z.object({
  body: z.object({
    item_id: z.string().min(1, "Item ID is required"),
    location: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      address: z.string().optional(),
    }),
    bounty: z.number().min(0, "Bounty cannot be negative"),
    payment_method: z.enum(["VNPAY", "MOMO"]),
  }),
});

export const webhookPaymentSchema = z.object({
  body: z.object({
    post_id: z.string(),
    amount: z.number(),
    provider: z.string(),
    transaction_code: z.string(),
    status: z.string(),
  }),
});
