import { Request, Response, NextFunction } from "express";
import { logger } from "../libs/logger";
import { ResponseUtil } from "../utils/response";

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
    return ResponseUtil.error(res, err.message, err.statusCode, err.code);
  }

  // Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    const prismaCode = (err as Error & { code?: string }).code;
    if (prismaCode === "P2002") {
      return ResponseUtil.conflict(res, "Resource already exists");
    }
    if (prismaCode === "P2025") {
      return ResponseUtil.notFound(res, "Resource not found");
    }
    return ResponseUtil.error(res);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return ResponseUtil.unauthorized(res, "Invalid token");
  }

  if (err.name === "TokenExpiredError") {
    return ResponseUtil.unauthorized(res, "Token expired");
  }

  // Default error
  return ResponseUtil.error(res);
}

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return ResponseUtil.notFound(res, `Route ${req.originalUrl} not found`);
}
