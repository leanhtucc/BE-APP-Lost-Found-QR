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
