"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const routes_1 = __importDefault(require("./routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
const rate_limit_middleware_1 = require("./middlewares/rate-limit.middleware");
/**
 * Express Application Setup
 */
const app = (0, express_1.default)();
// Security & Basic Middleware
app.use((0, helmet_1.default)()); // Security headers
app.use((0, cors_1.default)()); // CORS
app.use(express_1.default.json()); // JSON body parser
app.use(express_1.default.urlencoded({ extended: true })); // URL-encoded parser
// Serve static files (assets, images, etc.)
app.use("/public", express_1.default.static("public"));
// Rate limiting
app.use((0, rate_limit_middleware_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
}));
// Application Routes
app.use(routes_1.default);
// Error Handlers
app.use(error_middleware_1.notFoundHandler);
app.use(error_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map