import { Request, Response, NextFunction } from "express";
import { ResponseUtil } from "../utils/response";

/**
 * Simple Rate Limiting Middleware
 * TODO: Implement với Redis cho production
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier =
      req.user?.id || req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    const record = requestCounts.get(identifier);

    if (!record || now > record.resetTime) {
      requestCounts.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return next();
    }

    if (record.count >= config.max) {
      return res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
        error: { code: "RATE_LIMITED" },
        timestamp: new Date().toISOString(),
      });
    }

    record.count++;
    next();
  };
}
