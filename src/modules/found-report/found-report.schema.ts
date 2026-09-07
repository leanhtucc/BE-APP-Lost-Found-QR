import { z } from "zod";

export const foundReportBody = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  category: z.enum([
    "electronics",
    "wallet",
    "bag",
    "keys",
    "phone",
    "jewelry",
    "documents",
    "laptop",
    "other",
  ]),
  description: z.string().trim().max(500).optional(),
  imagePublicUrl: z
    .string()
    .url()
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "Ảnh phải được tải lên trước khi đăng"
    ),
  location: z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    address: z.string().trim().min(1).max(300),
  }),
});
export const createFoundReportSchema = z.object({ body: foundReportBody });
export const foundReportIdSchema = z.object({
  params: z.object({ id: z.string().min(1).max(100) }),
});
