import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { ResponseUtil } from "../../utils/response";
import { UploadService } from "./upload.service";

/**
 * Upload Controller
 * Handle file upload requests
 */

const uploadService = new UploadService();

export class UploadController {
  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }

      const userId = req.user?.id ?? "anonymous";
      const file = req.file;

      const result = await uploadService.uploadImage(file, userId);

      return ResponseUtil.success(res, result, "Image uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { filename } = req.params;
      const userId = req.user!.id;

      if (!filename) {
        return ResponseUtil.badRequest(res, "Filename is required");
      }

      await uploadService.deleteFile(filename, userId);

      return ResponseUtil.success(res, null, "Image deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
