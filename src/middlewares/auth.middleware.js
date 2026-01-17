"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.optionalAuth = optionalAuth;
const jwt_1 = require("../libs/jwt");
const response_1 = require("../utils/response");
const logger_1 = require("../libs/logger");
/**
 * Authentication Middleware
 */
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return response_1.ResponseUtil.unauthorized(res, "No token provided");
        }
        const token = authHeader.substring(7);
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        logger_1.logger.error("Auth middleware error:", error);
        if (error.name === "TokenExpiredError") {
            return response_1.ResponseUtil.unauthorized(res, "Token expired");
        }
        if (error.name === "JsonWebTokenError") {
            return response_1.ResponseUtil.unauthorized(res, "Invalid token");
        }
        return response_1.ResponseUtil.unauthorized(res, "Authentication failed");
    }
}
function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7);
            const decoded = (0, jwt_1.verifyAccessToken)(token);
            req.user = decoded;
        }
        next();
    }
    catch (error) {
        // Ignore errors for optional auth
        next();
    }
}
//# sourceMappingURL=auth.middleware.js.map