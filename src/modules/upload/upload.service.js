"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const error_middleware_1 = require("../../middlewares/error.middleware");
/**
 * Upload Service
 * Handle file operations
 */
class UploadService {
    uploadDir = path.join(process.cwd(), "public", "uploads");
    async uploadImage(file, userId) {
        const fileUrl = `/public/uploads/${file.filename}`;
        return {
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            url: fileUrl,
            uploadedBy: userId,
        };
    }
    async deleteFile(filename, userId) {
        const filePath = path.join(this.uploadDir, filename);
        if (!fs.existsSync(filePath)) {
            throw new error_middleware_1.AppError("File not found", 404);
        }
        try {
            fs.unlinkSync(filePath);
        }
        catch (error) {
            throw new error_middleware_1.AppError("Failed to delete file", 500);
        }
    }
}
exports.UploadService = UploadService;
//# sourceMappingURL=upload.service.js.map