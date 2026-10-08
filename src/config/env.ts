import "dotenv/config";
import { randomBytes } from "crypto";
import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(32).optional()
);

const rawEnv = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    ALLOW_REMOTE_NON_PRODUCTION_DATABASE: z.string().optional(),
    JWT_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().default("1d"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
    GUEST_JWT_SECRET: optionalSecret,
    GUEST_JWT_TTL: z
      .string()
      .regex(/^\d+[smhd]$/)
      .default("6h"),
    GUEST_JWT_MAX_AGE: z
      .string()
      .regex(/^\d+[smhd]$/)
      .default("72h"),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).optional(),
    GUEST_CLAIM_INACTIVE_HOURS: z.coerce.number().int().positive().default(48),
    REDIS_URL: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    API_PREFIX: z.string().default("/api"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    SKIP_EMAIL_VERIFICATION: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_ALLOWED_CLIENT_IDS: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().optional(),
    STREAM_API_KEY: z.string().optional(),
    STREAM_API_SECRET: z.string().optional(),
    APP_BASE_URL: z.string().default("http://localhost:3000"),
    APP_URL: z.string().optional(),
    FRONTEND_URL: z.string().default("http://localhost:19006"),
    VNPAY_TMN_CODE: z.string().optional(),
    VNPAY_HASH_SECRET: z.string().optional(),
    VNPAY_PAYMENT_URL: z.string().url().optional(),
    VNPAY_RETURN_URL: z.string().url().optional(),
    CORS_ORIGINS: z.string().optional(),
    FIREBASE_CONFIG_PATH: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .startsWith("sb_publishable_")
      .optional(),
    SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_").optional(),
    SUPABASE_JWKS_URL: z.string().url().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("item-images"),
    GOOGLE_API_KEY: z.string().optional(),
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().default("gemini-2.5-flash"),

    // TypeSafe AI (Jev)
    TYPESAFE_API_KEY: z.string().optional(),
    TYPESAFE_MODEL: z.string().default("jev-latest"),
    TYPESAFE_API_URL: z
      .string()
      .url()
      .default("https://api.typesafe.ai/v1/systemone"),
  })
  .parse(process.env);

if (rawEnv.NODE_ENV === "production" && !rawEnv.GUEST_JWT_SECRET) {
  throw new Error("GUEST_JWT_SECRET is required in production");
}
if (
  rawEnv.GUEST_JWT_SECRET &&
  [rawEnv.JWT_SECRET, rawEnv.JWT_REFRESH_SECRET].includes(
    rawEnv.GUEST_JWT_SECRET
  )
) {
  throw new Error("GUEST_JWT_SECRET must be distinct from user JWT secrets");
}

export const ENV = {
  NODE_ENV: rawEnv.NODE_ENV,
  PORT: rawEnv.PORT,

  // Database
  DATABASE_URL: rawEnv.DATABASE_URL,
  DIRECT_URL: rawEnv.DIRECT_URL || rawEnv.DATABASE_URL,
  ALLOW_REMOTE_NON_PRODUCTION_DATABASE:
    rawEnv.ALLOW_REMOTE_NON_PRODUCTION_DATABASE === "true",

  // JWT
  JWT_SECRET: rawEnv.JWT_SECRET,
  JWT_EXPIRES_IN: rawEnv.JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET: rawEnv.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: rawEnv.JWT_REFRESH_EXPIRES_IN,
  GUEST_JWT_SECRET: rawEnv.GUEST_JWT_SECRET || randomBytes(32).toString("hex"),
  GUEST_JWT_TTL: rawEnv.GUEST_JWT_TTL,
  GUEST_JWT_MAX_AGE: rawEnv.GUEST_JWT_MAX_AGE,
  TRUST_PROXY_HOPS:
    rawEnv.TRUST_PROXY_HOPS ?? (rawEnv.NODE_ENV === "production" ? 1 : 0),
  GUEST_CLAIM_INACTIVE_HOURS: rawEnv.GUEST_CLAIM_INACTIVE_HOURS,

  // Redis (optional)
  REDIS_URL: rawEnv.REDIS_URL || "",
  UPSTASH_REDIS_REST_URL: rawEnv.UPSTASH_REDIS_REST_URL || "",
  UPSTASH_REDIS_REST_TOKEN: rawEnv.UPSTASH_REDIS_REST_TOKEN || "",

  // App
  API_PREFIX: rawEnv.API_PREFIX,

  // Email (SMTP)
  SMTP_HOST: rawEnv.SMTP_HOST || "",
  SMTP_PORT: rawEnv.SMTP_PORT,
  SMTP_SECURE: rawEnv.SMTP_SECURE === "true" || rawEnv.SMTP_PORT === 465,
  SMTP_USER: rawEnv.SMTP_USER || "",
  SMTP_PASS: rawEnv.SMTP_PASS || "",
  SMTP_FROM:
    rawEnv.SMTP_FROM ||
    rawEnv.EMAIL_FROM ||
    `Lost & Found <${rawEnv.SMTP_USER || "no-reply@localhost"}>`,

  // Development Mode
  SKIP_EMAIL_VERIFICATION:
    rawEnv.SKIP_EMAIL_VERIFICATION === "true" ||
    rawEnv.NODE_ENV === "development",

  // Google OAuth
  GOOGLE_CLIENT_ID: rawEnv.GOOGLE_CLIENT_ID || "",
  GOOGLE_ALLOWED_CLIENT_IDS: (rawEnv.GOOGLE_ALLOWED_CLIENT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  GOOGLE_CLIENT_SECRET: rawEnv.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL:
    rawEnv.GOOGLE_CALLBACK_URL ||
    "http://localhost:3000/api/auth/google/callback",

  // Stream Chat
  STREAM_API_KEY: rawEnv.STREAM_API_KEY || "",
  STREAM_API_SECRET: rawEnv.STREAM_API_SECRET || "",

  // Item/QR Code Config
  APP_BASE_URL: rawEnv.APP_BASE_URL,
  APP_URL: rawEnv.APP_URL || rawEnv.APP_BASE_URL,

  // Frontend URL (for password reset links)
  FRONTEND_URL: rawEnv.FRONTEND_URL,
  CORS_ORIGINS: (rawEnv.CORS_ORIGINS || rawEnv.FRONTEND_URL)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // VNPay. The hash secret is server-only and is required before accepting a
  // payment webhook or creating a payment URL.
  VNPAY_TMN_CODE: rawEnv.VNPAY_TMN_CODE || "",
  VNPAY_HASH_SECRET: rawEnv.VNPAY_HASH_SECRET || "",
  VNPAY_PAYMENT_URL:
    rawEnv.VNPAY_PAYMENT_URL ||
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  VNPAY_RETURN_URL:
    rawEnv.VNPAY_RETURN_URL ||
    `${rawEnv.FRONTEND_URL.replace(/\/$/, "")}/payment-result`,

  FIREBASE_CONFIG_PATH: rawEnv.FIREBASE_CONFIG_PATH || "",
  FIREBASE_SERVICE_ACCOUNT_JSON: rawEnv.FIREBASE_SERVICE_ACCOUNT_JSON || "",
  FIREBASE_PROJECT_ID: rawEnv.FIREBASE_PROJECT_ID || "",
  FIREBASE_CLIENT_EMAIL: rawEnv.FIREBASE_CLIENT_EMAIL || "",
  FIREBASE_PRIVATE_KEY: (rawEnv.FIREBASE_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  ),
  SUPABASE_URL: rawEnv.SUPABASE_URL || "",
  SUPABASE_PUBLISHABLE_KEY: rawEnv.SUPABASE_PUBLISHABLE_KEY || "",
  SUPABASE_SECRET_KEY: rawEnv.SUPABASE_SECRET_KEY || "",
  SUPABASE_JWKS_URL: rawEnv.SUPABASE_JWKS_URL || "",
  SUPABASE_STORAGE_BUCKET: rawEnv.SUPABASE_STORAGE_BUCKET,
  GOOGLE_API_KEY: rawEnv.GOOGLE_API_KEY || rawEnv.GEMINI_API_KEY || "",
  GOOGLE_MAPS_API_KEY:
    rawEnv.GOOGLE_MAPS_API_KEY || rawEnv.GOOGLE_API_KEY || "",
  AI_MODEL: rawEnv.AI_MODEL,

  // TypeSafe AI (Jev)
  TYPESAFE_API_KEY: rawEnv.TYPESAFE_API_KEY || "",
  TYPESAFE_MODEL: rawEnv.TYPESAFE_MODEL,
  TYPESAFE_API_URL: rawEnv.TYPESAFE_API_URL,
} as const;

export const isDevelopment = ENV.NODE_ENV === "development";
export const isProduction = ENV.NODE_ENV === "production";
export const isTest = ENV.NODE_ENV === "test";
