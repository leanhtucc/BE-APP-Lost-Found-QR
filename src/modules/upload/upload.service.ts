import path from "path";
import { ENV } from "../../config/env";
import { getSupabaseAdmin } from "../../config/supabase";
import { AppError } from "../../middlewares/error.middleware";
import { nanoid } from "nanoid";

/**
 * Upload Service
 * Handle file operations
 */

export class UploadService {
  async uploadImage(
    file: Express.Multer.File,
    userId: string,
    bucket = ENV.SUPABASE_STORAGE_BUCKET
  ) {
    if (!file.buffer) {
      throw new AppError("Upload buffer is unavailable", 500);
    }

    const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
    const filename = `${Date.now()}-${nanoid(10)}${extension}`;
    const objectPath = `${userId}/${filename}`;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: "31536000",
        upsert: false,
      });

    if (error) {
      throw new AppError(`Failed to upload image: ${error.message}`, 502);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

    return {
      filename,
      objectPath,
      bucket,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      url: data.publicUrl,
      uploadedBy: userId,
    };
  }

  async deleteFile(filename: string, userId: string): Promise<void> {
    if (path.basename(filename) !== filename) {
      throw new AppError("Invalid filename", 400);
    }

    const objectPath = `${userId}/${filename}`;
    const { error } = await getSupabaseAdmin()
      .storage.from(ENV.SUPABASE_STORAGE_BUCKET)
      .remove([objectPath]);

    if (error) {
      throw new AppError(`Failed to delete file: ${error.message}`, 502);
    }
  }
}

export const uploadService = new UploadService();
