import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../libs/jwt";
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

    const decoded = verifyAccessToken(token);
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

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
}
