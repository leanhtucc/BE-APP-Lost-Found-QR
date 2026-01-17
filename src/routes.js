"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const env_1 = require("./config/env");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const item_routes_1 = __importDefault(require("./modules/item/item.routes"));
const stream_routes_1 = __importDefault(require("./modules/stream/stream.routes"));
const upload_routes_1 = __importDefault(require("./modules/upload/upload.routes"));
/**
 * Application Routes
 * Tập trung tất cả routes của ứng dụng
 */
const router = (0, express_1.Router)();
// Health check routes
router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Lost & Found API is running 🚀",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
    });
});
router.get("/health", (req, res) => {
    res.json({
        success: true,
        status: "healthy",
        uptime: process.uptime(),
        environment: env_1.ENV.NODE_ENV,
    });
});
// API Routes - Đăng ký trực tiếp tất cả module routes
router.use(`${env_1.ENV.API_PREFIX}/auth`, auth_routes_1.default);
router.use(`${env_1.ENV.API_PREFIX}/upload`, upload_routes_1.default);
router.use(`${env_1.ENV.API_PREFIX}/stream`, stream_routes_1.default);
router.use(env_1.ENV.API_PREFIX, item_routes_1.default); // Item routes bao gồm /items và /scan
exports.default = router;
//# sourceMappingURL=routes.js.map