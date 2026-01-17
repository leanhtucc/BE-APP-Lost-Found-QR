"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isProduction = exports.isDevelopment = exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.ENV = {
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
    // Email (SMTP)
    SMTP_HOST: process.env.SMTP_HOST || "",
    SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
    SMTP_SECURE: process.env.SMTP_SECURE === "true",
    SMTP_USER: process.env.SMTP_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || "",
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || "noreply@lostfound.com",
    // Development Mode
    SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION === "true" ||
        process.env.NODE_ENV === "development",
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || "Lost & Found",
    // Google OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:3000/api/auth/google/callback",
    // Stream Chat
    STREAM_API_KEY: process.env.STREAM_API_KEY || "",
    STREAM_API_SECRET: process.env.STREAM_API_SECRET || "",
    // Item/QR Code Config
    APP_BASE_URL: process.env.APP_BASE_URL || "http://localhost:3000",
    // Frontend URL (for password reset links)
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:19006", // Default Expo URL
};
exports.isDevelopment = exports.ENV.NODE_ENV === "development";
exports.isProduction = exports.ENV.NODE_ENV === "production";
exports.isTest = exports.ENV.NODE_ENV === "test";
//# sourceMappingURL=env.js.map