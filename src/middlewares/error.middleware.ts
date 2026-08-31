import { Request, Response, NextFunction } from "express";
import { logger } from "../libs/logger";
import { ResponseUtil } from "../utils/response";
import { isDevelopment } from "../config/env";

/**
 * Global Error Handler Middleware
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational = true,
    public code?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error("Error occurred:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    if (err.code) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: { code: err.code },
        timestamp: new Date().toISOString(),
      });
    }
    return ResponseUtil.error(
      res,
      err.message,
      err.statusCode,
      isDevelopment ? err.stack : undefined
    );
  }

  // Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    return ResponseUtil.error(res, "Database error", 400);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return ResponseUtil.unauthorized(res, "Invalid token");
  }

  if (err.name === "TokenExpiredError") {
    return ResponseUtil.unauthorized(res, "Token expired");
  }

  // Default error
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: {
      code: "INTERNAL_ERROR",
      ...(isDevelopment ? { detail: err.message } : {}),
    },
    timestamp: new Date().toISOString(),
  });
}

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return ResponseUtil.notFound(res, `Route ${req.originalUrl} not found`);
}
