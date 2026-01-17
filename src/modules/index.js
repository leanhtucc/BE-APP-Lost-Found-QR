"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth/auth.routes"));
const item_routes_1 = __importDefault(require("./item/item.routes"));
const upload_routes_1 = __importDefault(require("./upload/upload.routes"));
/**
 * Export all module routes
 */
const router = (0, express_1.Router)();
router.use("/auth", auth_routes_1.default);
router.use("/upload", upload_routes_1.default);
// Item routes (bao gồm cả /items và /scan)
router.use(item_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map