"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseUtil = void 0;
class ResponseUtil {
    static success(res, data, message = "Success", statusCode = 200) {
        const response = {
            success: true,
            message,
            data,
            timestamp: new Date().toISOString(),
        };
        return res.status(statusCode).json(response);
    }
    static created(res, data, message = "Created successfully") {
        return this.success(res, data, message, 201);
    }
    static error(res, message = "Internal server error", statusCode = 500, error) {
        const response = {
            success: false,
            message,
            ...(error && { error }),
            timestamp: new Date().toISOString(),
        };
        return res.status(statusCode).json(response);
    }
    static badRequest(res, message = "Bad request", error) {
        return this.error(res, message, 400, error);
    }
    static unauthorized(res, message = "Unauthorized") {
        return this.error(res, message, 401);
    }
    static forbidden(res, message = "Forbidden") {
        return this.error(res, message, 403);
    }
    static notFound(res, message = "Resource not found") {
        return this.error(res, message, 404);
    }
    static conflict(res, message = "Conflict") {
        return this.error(res, message, 409);
    }
}
exports.ResponseUtil = ResponseUtil;
//# sourceMappingURL=response.js.map