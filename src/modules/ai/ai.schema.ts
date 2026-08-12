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
