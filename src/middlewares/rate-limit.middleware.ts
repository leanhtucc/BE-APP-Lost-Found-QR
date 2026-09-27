import { Request, Response, NextFunction } from "express";
import { ResponseUtil } from "../utils/response";

/**
 * Simple Rate Limiting Middleware
 * TODO: Implement với Redis cho production
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
}

export function rateLimit(config: RateLimitConfig) {
  // Instance-scoped map so different limiters don't pollute each other's buckets
  const instanceCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier =
      config.keyGenerator?.(req) ??
      (req.user?.id || req.ip || req.socket.remoteAddress || "unknown");
    const now = Date.now();

    const record = instanceCounts.get(identifier);

    if (!record || now > record.resetTime) {
      instanceCounts.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs,
      });

      // Periodic garbage collection to prevent memory leak when map grows
      if (instanceCounts.size > 2000) {
        for (const [key, val] of instanceCounts.entries()) {
          if (now > val.resetTime) {
            instanceCounts.delete(key);
          }
        }
      }

      return next();
    }

    if (record.count >= config.max) {
      return ResponseUtil.tooManyRequests(res);
    }

    record.count++;
    next();
  };
}
