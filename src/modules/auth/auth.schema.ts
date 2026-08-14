import { z } from "zod";

/**
 * Auth Module Validation Schemas
 */

// Custom validators
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

// Email regex hỗ trợ plus addressing (+) và các ký tự đặc biệt hợp lệ
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Invalid email format")
  .regex(emailRegex, "Invalid email format");

const displayNameSchema = z
  .string()
  .min(2, "Full name must be at least 2 characters")
  .max(50, "Full name is too long")
  .trim()
  .regex(
    /^[a-zA-Z0-9\s\u00C0-\u1EF9]+$/,
    "Full name can only contain letters, numbers, and spaces"
  );

export const registerSchema = z.object({
  body: z
    .object({
      email: emailSchema,
      password: z
        .string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters")
        .max(100, "Password is too long")
        .regex(
          passwordRegex,
          "Password must contain at least one uppercase letter, one lowercase letter, and one number"
        ),
      full_name: displayNameSchema.optional(),
      fullName: displayNameSchema.optional(),
      displayName: displayNameSchema.optional(),
      password_confirmation: z.string().optional(),
      confirmPassword: z.string().optional(),
      confirm_password: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const displayName = data.full_name ?? data.fullName ?? data.displayName;
      const passwordConfirmation =
        data.password_confirmation ??
        data.confirmPassword ??
        data.confirm_password;

      if (!displayName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["full_name"],
          message: "Full name is required",
        });
      }

      if (!passwordConfirmation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password_confirmation"],
          message: "Password confirmation is required",
        });
      } else if (passwordConfirmation !== data.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password_confirmation"],
          message: "Password confirmation does not match",
        });
      }
    })
    .transform((data) => ({
      email: data.email,
      password: data.password,
      displayName: data.full_name ?? data.fullName ?? data.displayName!,
    })),
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
    bio: z.string().max(500, "Bio is too long (max 500 characters)").optional(),
    addressCity: z
      .string()
      .max(100, "Address is too long (max 100 characters)")
      .optional(),
    privacySettings: z
      .object({
        showPhone: z.boolean().optional(),
        showEmail: z.boolean().optional(),
      })
      .optional(),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: emailSchema,

    code: z
      .string({ required_error: "Verification code is required" })
      .length(6, "Verification code must be 6 digits")
      .regex(/^\d{6}$/, "Verification code must contain only numbers"),
  }),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
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

// Firebase Auth Schema (for mobile app flow)
export const firebaseVerifySchema = z.object({
  body: z.object({
    idToken: z
      .string({
        required_error: "Firebase ID token is required",
      })
      .min(1, "Firebase ID token is required"),
  }),
});
