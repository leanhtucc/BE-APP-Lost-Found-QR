import { z } from "zod";

// POST /v1/reports. Currency and all fees are decided by the server.
export const createReportSchema = z.object({
  body: z
    .object({
      item_id: z.string().min(1, "item_id is required").optional(),
      itemId: z.string().min(1, "itemId is required").optional(),
      location: z
        .object({
          lat: z.number().finite().min(-90).max(90),
          lng: z.number().finite().min(-180).max(180),
          address: z.string().trim().max(300).optional().nullable(),
        })
        .passthrough(),
      radar: z
        .object({
          radius: z
            .number()
            .int()
            .min(100, "radius must be at least 100m")
            .max(5000)
            .optional(),
          duration_hours: z.number().int().min(1).max(168).optional(),
          durationHours: z.number().int().min(1).max(168).optional(),
        })
        .passthrough()
        .optional(),
      reward: z
        .object({
          base_amount: z.number().int().min(10_000).max(100_000_000).optional(),
          baseAmount: z.number().int().min(10_000).max(100_000_000).optional(),
          amount: z.number().int().min(10_000).max(100_000_000).optional(),
          is_custom: z.boolean().optional(),
          isCustom: z.boolean().optional(),
        })
        .passthrough()
        .optional(),
      idempotency_key: z.string().optional(),
      idempotencyKey: z.string().optional(),
    })
    .passthrough()
    .superRefine((data, ctx) => {
      if (!data.item_id && !data.itemId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "item_id is required",
          path: ["item_id"],
        });
      }
      const baseReward =
        data.reward?.base_amount ??
        data.reward?.baseAmount ??
        data.reward?.amount;
      if (baseReward === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reward.base_amount is required",
          path: ["reward", "base_amount"],
        });
      } else if (baseReward < 10_000 || baseReward > 100_000_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reward.base_amount must be between 10,000 and 100,000,000",
          path: ["reward", "base_amount"],
        });
      }
    }),
});

export const reportIdParamSchema = z.object({
  params: z.object({ reportId: z.string().min(1, "reportId is required") }),
});

// A webhook can be sent in the documented generic format or in VNPay's native
// callback format. `passthrough` preserves every vnp_* field for HMAC checking.
export const webhookPaymentSchema = z.object({
  body: z
    .object({
      provider_order_id: z.string().optional(),
      provider_transaction_id: z.string().optional(),
      amount: z.coerce.number().positive().optional(),
      currency: z.string().optional(),
      status: z.string().optional(),
      signature: z.string().optional(),
      vnp_TxnRef: z.string().optional(),
      vnp_TransactionNo: z.string().optional(),
      vnp_Amount: z.coerce.number().positive().optional(),
      vnp_CurrCode: z.string().optional(),
      vnp_ResponseCode: z.string().optional(),
      vnp_TransactionStatus: z.string().optional(),
      vnp_SecureHash: z.string().optional(),
    })
    .passthrough()
    .superRefine((value, ctx) => {
      if (!(value.provider_order_id || value.vnp_TxnRef)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "provider order id is required",
        });
      }
      if (!(value.provider_transaction_id || value.vnp_TransactionNo)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "provider transaction id is required",
        });
      }
      if (!(value.amount || value.vnp_Amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "amount is required",
        });
      }
      if (!(value.signature || value.vnp_SecureHash)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "payment signature is required",
        });
      }
    }),
});

export const reportLostItemSchema = createReportSchema;
