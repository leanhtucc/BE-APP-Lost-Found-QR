import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3000", 10),

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "refresh-secret",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",

  // Redis (optional)
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  // App
  API_PREFIX: process.env.API_PREFIX || "/api",

  // Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "Lost & Found <onboarding@resend.dev>",

  // Development Mode
  SKIP_EMAIL_VERIFICATION:
    process.env.SKIP_EMAIL_VERIFICATION === "true" ||
    process.env.NODE_ENV === "development",

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:3000/api/auth/google/callback",

  // Stream Chat
  STREAM_API_KEY: process.env.STREAM_API_KEY || "",
  STREAM_API_SECRET: process.env.STREAM_API_SECRET || "",

  // Item/QR Code Config
  APP_BASE_URL: process.env.APP_BASE_URL || "http://localhost:3000",

  // Frontend URL (for password reset links)
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:19006", // Default Expo URL
} as const;

export const isDevelopment = ENV.NODE_ENV === "development";
export const isProduction = ENV.NODE_ENV === "production";
export const isTest = ENV.NODE_ENV === "test";
