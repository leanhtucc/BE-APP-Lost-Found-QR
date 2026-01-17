"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
const response_1 = require("../utils/response");
const requestCounts = new Map();
function rateLimit(config) {
    return (req, res, next) => {
        const identifier = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        const record = requestCounts.get(identifier);
        if (!record || now > record.resetTime) {
            requestCounts.set(identifier, {
                count: 1,
                resetTime: now + config.windowMs,
            });
            return next();
        }
        if (record.count >= config.max) {
            return response_1.ResponseUtil.error(res, "Too many requests, please try again later", 429);
        }
        record.count++;
        next();
    };
}
//# sourceMappingURL=rate-limit.middleware.js.map