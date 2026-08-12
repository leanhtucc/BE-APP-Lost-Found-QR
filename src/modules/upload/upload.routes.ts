import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { uploadController } from "./upload.controller";

const router = Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
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
