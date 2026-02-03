import { z } from "zod";

/**
 * Auth Module Validation Schemas
 */

// Custom validators
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

// Email regex hỗ trợ plus addressing (+) và các ký tự đặc biệt hợp lệ
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .regex(emailRegex, "Invalid email format")
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

    photoURL: z.string().optional().or(z.literal("")),
    phoneNumber: z
      .string()
      .regex(/^[0-9]{10,11}$/, "Invalid phone number format")
      .optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .regex(emailRegex, "Invalid email format")
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
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
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

    photoURL: z.string().optional().or(z.literal("")),
    phoneNumber: z
      .string()
      .regex(/^[0-9]{10,11}$/, "Invalid phone number format")
      .optional(),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .regex(emailRegex, "Invalid email format")
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
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .regex(emailRegex, "Invalid email format")
      .toLowerCase()
      .trim(),
  }),
});

// Forgot Password Schema
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .regex(emailRegex, "Invalid email format")
      .toLowerCase()
      .trim(),
  }),
});

// Reset Password Schema
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string({
        required_error: "Reset token is required",
      })
      .min(1, "Reset token is required"),
    newPassword: z
      .string({
        required_error: "New password is required",
      })
      .min(6, "Password must be at least 6 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
  }),
});

// Google Auth Schema (for mobile app flow)
export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z
      .string({
        required_error: "Google ID token is required",
      })
      .min(1, "Google ID token is required"),
  }),
});
