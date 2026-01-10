import { Router } from "express";
import { uploadController } from "./upload.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import multer from "multer";
import path from "path";
import * as fs from "fs";
import { nanoid } from "nanoid";

const router = Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    // Create directory if not exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG and WebP are allowed"));
    }
  },
});

/**
 * @route POST /api/upload/image
 * @desc Upload single image
 * @access Private
 */
router.post(
  "/image",
  authMiddleware,
  upload.single("image"),
  uploadController.uploadImage
);

/**
 * @route DELETE /api/upload/:filename
 * @desc Delete uploaded image
 * @access Private
 */
router.delete("/:filename", authMiddleware, uploadController.deleteImage);

export default router;
