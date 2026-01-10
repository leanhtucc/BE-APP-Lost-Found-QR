import * as fs from "fs";
import * as path from "path";
import { AppError } from "../../middlewares/error.middleware";

/**
 * Upload Service
 * Handle file operations
 */

export class UploadService {
  private readonly uploadDir = path.join(process.cwd(), "public", "uploads");

  async uploadImage(file: Express.Multer.File, userId: string) {
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

  async deleteFile(filename: string, userId: string): Promise<void> {
    const filePath = path.join(this.uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new AppError("File not found", 404);
    }

    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      throw new AppError("Failed to delete file", 500);
    }
  }
}
