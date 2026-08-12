import "dotenv/config";
import { z } from "zod";

const rawEnv = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().default("7d"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
    REDIS_URL: z.string().optional(),
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
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().optional(),
    STREAM_API_KEY: z.string().optional(),
    STREAM_API_SECRET: z.string().optional(),
    APP_BASE_URL: z.string().default("http://localhost:3000"),
    APP_URL: z.string().optional(),
    FRONTEND_URL: z.string().default("http://localhost:19006"),
    CORS_ORIGINS: z.string().optional(),
    FIREBASE_CONFIG_PATH: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("item-images"),
    GOOGLE_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().default("gemini-2.5-flash"),
  })
  .parse(process.env);

export const ENV = {
  NODE_ENV: rawEnv.NODE_ENV,
  PORT: rawEnv.PORT,

  // Database
  DATABASE_URL: rawEnv.DATABASE_URL,
  DIRECT_URL: rawEnv.DIRECT_URL || rawEnv.DATABASE_URL,

  // JWT
  JWT_SECRET: rawEnv.JWT_SECRET,
  JWT_EXPIRES_IN: rawEnv.JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET: rawEnv.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: rawEnv.JWT_REFRESH_EXPIRES_IN,

  // Redis (optional)
  REDIS_URL: rawEnv.REDIS_URL || "",

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

  FIREBASE_CONFIG_PATH: rawEnv.FIREBASE_CONFIG_PATH || "",
  FIREBASE_SERVICE_ACCOUNT_JSON: rawEnv.FIREBASE_SERVICE_ACCOUNT_JSON || "",
  FIREBASE_PROJECT_ID: rawEnv.FIREBASE_PROJECT_ID || "",
  FIREBASE_CLIENT_EMAIL: rawEnv.FIREBASE_CLIENT_EMAIL || "",
  FIREBASE_PRIVATE_KEY: (rawEnv.FIREBASE_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  ),
  SUPABASE_URL: rawEnv.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: rawEnv.SUPABASE_SERVICE_ROLE_KEY || "",
  SUPABASE_STORAGE_BUCKET: rawEnv.SUPABASE_STORAGE_BUCKET,
  GOOGLE_API_KEY: rawEnv.GOOGLE_API_KEY || rawEnv.GEMINI_API_KEY || "",
  AI_MODEL: rawEnv.AI_MODEL,
} as const;

export const isDevelopment = ENV.NODE_ENV === "development";
export const isProduction = ENV.NODE_ENV === "production";
export const isTest = ENV.NODE_ENV === "test";
