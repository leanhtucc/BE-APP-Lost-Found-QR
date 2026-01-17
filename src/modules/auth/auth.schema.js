"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.resendVerificationSchema = exports.verifyEmailSchema = exports.updateProfileSchema = exports.refreshTokenSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
/**
 * Auth Module Validation Schemas
 */
// Custom validators
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
exports.registerSchema = zod_1.z.object({
    query: zod_1.z.object({
        email: zod_1.z
            .string({
            required_error: "Email is required",
        })
            .email("Invalid email format")
            .toLowerCase()
            .trim(),
        password: zod_1.z
            .string({
            required_error: "Password is required",
        })
            .min(8, "Password must be at least 8 characters")
            .max(100, "Password is too long")
            .regex(passwordRegex, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
        displayName: zod_1.z
            .string({
            required_error: "Display name is required",
        })
            .min(2, "Display name must be at least 2 characters")
            .max(50, "Display name is too long")
            .trim()
            .regex(/^[a-zA-Z0-9\s\u00C0-\u1EF9]+$/, "Display name can only contain letters, numbers, and spaces"),
        photoURL: zod_1.z
            .union([zod_1.z.string().url("Invalid URL format"), zod_1.z.literal("")])
            .optional(),
    }),
});
exports.loginSchema = zod_1.z.object({
    query: zod_1.z.object({
        email: zod_1.z
            .string({
            required_error: "Email is required",
        })
            .email("Invalid email format")
            .toLowerCase()
            .trim(),
        password: zod_1.z
            .string({
            required_error: "Password is required",
        })
            .min(1, "Password is required"),
    }),
});
exports.refreshTokenSchema = zod_1.z.object({
    query: zod_1.z.object({
        refreshToken: zod_1.z.string().min(1, "Refresh token is required"),
    }),
});
exports.updateProfileSchema = zod_1.z.object({
    query: zod_1.z.object({
        displayName: zod_1.z
            .string({
            required_error: "Display name is required",
        })
            .min(2, "Display name must be at least 2 characters")
            .max(50, "Display name is too long")
            .trim()
            .regex(/^[a-zA-Z0-9\s\u00C0-\u1EF9]+$/, "Display name can only contain letters, numbers, and spaces")
            .optional(),
        photoURL: zod_1.z
            .union([zod_1.z.string().url("Invalid URL format"), zod_1.z.literal("")])
            .optional(),
    }),
});
exports.verifyEmailSchema = zod_1.z.object({
    query: zod_1.z.object({
        email: zod_1.z
            .string({
            required_error: "Email is required",
        })
            .email("Invalid email format")
            .toLowerCase()
            .trim(),
        code: zod_1.z
            .string({
            required_error: "Verification code is required",
        })
            .length(6, "Verification code must be 6 digits")
            .regex(/^\d{6}$/, "Verification code must contain only numbers"),
    }),
});
exports.resendVerificationSchema = zod_1.z.object({
    query: zod_1.z.object({
        email: zod_1.z
            .string({
            required_error: "Email is required",
        })
            .email("Invalid email format")
            .toLowerCase()
            .trim(),
    }),
});
// Forgot Password Schema
exports.forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({
            required_error: "Email is required",
        })
            .email("Invalid email format")
            .toLowerCase()
            .trim(),
    }),
});
// Reset Password Schema
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z
            .string({
            required_error: "Reset token is required",
        })
            .min(1, "Reset token is required"),
        newPassword: zod_1.z
            .string({
            required_error: "New password is required",
        })
            .min(6, "Password must be at least 6 characters")
            .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
    }),
});
//# sourceMappingURL=auth.schema.js.map