"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const logger_1 = require("../libs/logger");
const response_1 = require("../utils/response");
const env_1 = require("../config/env");
/**
 * Global Error Handler Middleware
 */
class AppError extends Error {
    message;
    statusCode;
    isOperational;
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, next) {
    logger_1.logger.error("Error occurred:", {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    if (err instanceof AppError) {
        return response_1.ResponseUtil.error(res, err.message, err.statusCode, env_1.isDevelopment ? err.stack : undefined);
    }
    // Prisma errors
    if (err.name === "PrismaClientKnownRequestError") {
        return response_1.ResponseUtil.error(res, "Database error", 400);
    }
    // JWT errors
    if (err.name === "JsonWebTokenError") {
        return response_1.ResponseUtil.unauthorized(res, "Invalid token");
    }
    if (err.name === "TokenExpiredError") {
        return response_1.ResponseUtil.unauthorized(res, "Token expired");
    }
    // Default error
    return response_1.ResponseUtil.error(res, "Internal server error", 500, env_1.isDevelopment ? err.message : undefined);
}
function notFoundHandler(req, res, next) {
    return response_1.ResponseUtil.notFound(res, `Route ${req.originalUrl} not found`);
}
//# sourceMappingURL=error.middleware.js.map