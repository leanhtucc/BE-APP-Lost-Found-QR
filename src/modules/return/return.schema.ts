import { z } from "zod";

export const createOrGetSessionSchema = z.object({
  body: z.object({
    channelId: z.string().min(1, "channelId is required"),
    itemId: z.string().optional(),
  }),
});

export const proposeMeetupSchema = z.object({
  body: z.object({
    address: z.string().min(1, "address is required"),
    name: z.string().optional(),
    latitude: z
      .number({ required_error: "latitude is required" })
      .min(-90, "Latitude must be >= -90")
      .max(90, "Latitude must be <= 90"),
    longitude: z
      .number({ required_error: "longitude is required" })
      .min(-180, "Longitude must be >= -180")
      .max(180, "Longitude must be <= 180"),
    scheduledTime: z.string().min(1, "scheduledTime is required"),
    notes: z
      .string()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional(),
  }),
});

export const confirmHandoverSchema = z.object({
  body: z.object({
    code: z
      .string()
      .regex(/^\d{6}$/, "Verification code must be 6 digits")
      .optional(),
    idempotencyKey: z.string().optional(),
    role: z.enum(["OWNER", "FINDER"]).optional(),
  }),
});

export const disputeHandoverSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(3, "Dispute reason must be at least 3 characters")
      .max(1000, "Dispute reason cannot exceed 1000 characters"),
    disputedBy: z.string().optional(),
  }),
});

export const submitRatingSchema = z.object({
  body: z.object({
    score: z
      .number({ required_error: "Score is required" })
      .int("Score must be an integer")
      .min(1, "Score must be at least 1")
      .max(5, "Score cannot exceed 5"),
    tags: z.array(z.string()).default([]),
    comment: z
      .string()
      .max(1000, "Comment cannot exceed 1000 characters")
      .optional(),
  }),
});
