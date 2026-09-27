import { Response } from "express";

/**
 * Standardized API Response Utilities
 */

export interface ApiResponse<T = any> {
  status: number;
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: unknown;
    fields?: Record<string, string>;
  };
  timestamp: string;
}

export class ResponseUtil {
  private static defaultErrorCode(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return "BAD_REQUEST";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 409:
        return "CONFLICT";
      case 429:
        return "RATE_LIMITED";
      default:
        return "INTERNAL_ERROR";
    }
  }

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
    code = ResponseUtil.defaultErrorCode(statusCode),
    details?: unknown
  ) {
    const response: ApiResponse = {
      status: statusCode,
      success: false,
      message,
      error: {
        code,
        ...(details !== undefined ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static badRequest(res: Response, message = "Bad request", code?: string) {
    return this.error(res, message, 400, code);
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

  static tooManyRequests(
    res: Response,
    message = "Too many requests, please try again later"
  ) {
    return this.error(res, message, 429, "RATE_LIMITED");
  }
}
