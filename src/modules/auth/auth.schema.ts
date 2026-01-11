import { z } from "zod";

/**
 * Auth Module Validation Schemas
 */

// Custom validators
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const registerSchema = z.object({
  query: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .toLowerCase()
      .trim(),

    password: z
      .string({
        required_error: "Password is required",
      })
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password is too long")
      .regex(
        passwordRegex,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),

    displayName: z
      .string({
        required_error: "Display name is required",
      })
      .min(2, "Display name must be at least 2 characters")
      .max(50, "Display name is too long")
      .trim()
      .regex(
        /^[a-zA-Z0-9\s\u00C0-\u1EF9]+$/,
        "Display name can only contain letters, numbers, and spaces"
      ),

    photoURL: z
      .union([z.string().url("Invalid URL format"), z.literal("")])
      .optional(),
  }),
});

export const loginSchema = z.object({
  query: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .toLowerCase()
      .trim(),

    password: z
      .string({
        required_error: "Password is required",
      })
      .min(1, "Password is required"),
  }),
});

export const refreshTokenSchema = z.object({
  query: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export const updateProfileSchema = z.object({
  query: z.object({
    displayName: z
      .string({
        required_error: "Display name is required",
      })
      .min(2, "Display name must be at least 2 characters")
      .max(50, "Display name is too long")
      .trim()
      .regex(
        /^[a-zA-Z0-9\s\u00C0-\u1EF9]+$/,
        "Display name can only contain letters, numbers, and spaces"
      )
      .optional(),

    photoURL: z
      .union([z.string().url("Invalid URL format"), z.literal("")])
      .optional(),
  }),
});

export const verifyEmailSchema = z.object({
  query: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .toLowerCase()
      .trim(),

    code: z
      .string({
        required_error: "Verification code is required",
      })
      .length(6, "Verification code must be 6 digits")
      .regex(/^\d{6}$/, "Verification code must contain only numbers"),
  }),
});

export const resendVerificationSchema = z.object({
  query: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .toLowerCase()
      .trim(),
  }),
});
