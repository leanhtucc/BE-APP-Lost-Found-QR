import { Request, Response, NextFunction } from "express";
import { authenticateAccessToken } from "../libs/supabase-auth";
import { ResponseUtil } from "../utils/response";
import { logger } from "../libs/logger";

/**
 * Authentication Middleware
 */

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return ResponseUtil.unauthorized(res, "No token provided");
    }

    const token = authHeader.substring(7);

    const decoded = await authenticateAccessToken(token);
    if (!decoded) {
      return ResponseUtil.unauthorized(res, "User profile not found");
    }
    req.user = decoded;

    next();
  } catch (error: any) {
    logger.error("Auth middleware error:", error);

    if (error.name === "TokenExpiredError") {
      return ResponseUtil.unauthorized(res, "Token expired");
    }

    if (error.name === "JsonWebTokenError") {
      return ResponseUtil.unauthorized(res, "Invalid token");
    }

    return ResponseUtil.unauthorized(res, "Authentication failed");
  }
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = await authenticateAccessToken(token, false);
      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
}
