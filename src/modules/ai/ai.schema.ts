import { z } from "zod";

export const createConversationSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(120).optional(),
  }),
});

export const conversationParamsSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1),
  }),
});

export const sendAiMessageSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1),
  }),
  body: z.object({
    content: z.string().trim().min(1).max(4000),
  }),
});

export const classifyItemSchema = z.object({
  body: z.object({
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(1000, "Description must be less than 1000 characters"),
  }),
});
