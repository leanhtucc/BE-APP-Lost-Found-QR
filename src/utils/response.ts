import { Response } from "express";

/**
 * Standardized API Response Utilities
 */

export interface ApiResponse<T = any> {
  status: number;
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export class ResponseUtil {
  static success<T>(
    res: Response,
    data: T,
    message = "Success",
    statusCode = 200
  ) {
    const response: ApiResponse<T> = {
      status: statusCode,
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message = "Created successfully") {
    return this.success(res, data, message, 201);
  }

  static error(
    res: Response,
    message = "Internal server error",
    statusCode = 500,
    error?: string
  ) {
    const response: ApiResponse = {
      status: statusCode,
      success: false,
      message,
      ...(error && { error }),
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static badRequest(res: Response, message = "Bad request", error?: string) {
    return this.error(res, message, 400, error);
  }

  static unauthorized(res: Response, message = "Unauthorized") {
    return this.error(res, message, 401);
  }

  static forbidden(res: Response, message = "Forbidden") {
    return this.error(res, message, 403);
  }

  static notFound(res: Response, message = "Resource not found") {
    return this.error(res, message, 404);
  }

  static conflict(res: Response, message = "Conflict") {
    return this.error(res, message, 409);
  }
}
