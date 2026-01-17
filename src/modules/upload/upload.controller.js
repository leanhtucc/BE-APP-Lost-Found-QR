"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadController = exports.UploadController = void 0;
const error_middleware_1 = require("../../middlewares/error.middleware");
const response_1 = require("../../utils/response");
const upload_service_1 = require("./upload.service");
/**
 * Upload Controller
 * Handle file upload requests
 */
const uploadService = new upload_service_1.UploadService();
class UploadController {
    async uploadImage(req, res, next) {
        try {
            if (!req.file) {
                throw new error_middleware_1.AppError("No file uploaded", 400);
            }
            const userId = req.user.id;
            const file = req.file;
            const result = await uploadService.uploadImage(file, userId);
            return response_1.ResponseUtil.success(res, result, "Image uploaded successfully");
        }
        catch (error) {
            next(error);
        }
    }
    async deleteImage(req, res, next) {
        try {
            const { filename } = req.params;
            const userId = req.user.id;
            if (!filename) {
                return response_1.ResponseUtil.badRequest(res, "Filename is required");
            }
            await uploadService.deleteFile(filename, userId);
            return response_1.ResponseUtil.success(res, null, "Image deleted successfully");
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UploadController = UploadController;
exports.uploadController = new UploadController();
//# sourceMappingURL=upload.controller.js.map