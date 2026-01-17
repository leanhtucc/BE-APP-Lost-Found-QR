import { z } from "zod";

export const createChannelSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, "Item ID is required"),
    finderId: z.string().min(1, "Finder ID is required"),
  }),
});

export const closeChannelSchema = z.object({
  params: z.object({
    channelId: z.string().min(1, "Channel ID is required"),
  }),
});

export const messageIdSchema = z.object({
  params: z.object({
    messageId: z.string().min(1, "Message ID is required"),
  }),
});

export const muteUserSchema = z.object({
  params: z.object({
    channelId: z.string().min(1, "Channel ID is required"),
    targetUserId: z.string().min(1, "Target User ID is required"),
    timeout: z.string().optional(), // timeout in minutes as string
  }),
});

export const banUserSchema = z.object({
  params: z.object({
    channelId: z.string().min(1, "Channel ID is required"),
    targetUserId: z.string().min(1, "Target User ID is required"),
    timeout: z.string().optional(), // timeout in minutes
    reason: z.string().optional(),
  }),
});

export const channelUserSchema = z.object({
  params: z.object({
    channelId: z.string().min(1, "Channel ID is required"),
    targetUserId: z.string().min(1, "Target User ID is required"),
  }),
});

export const activitySchema = z.object({
  params: z.object({
    activityType: z.enum([
      "new_message",
      "new_channel",
      "item_found",
      "item_returned",
    ]),
  }),
});
