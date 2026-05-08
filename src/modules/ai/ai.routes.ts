import { Router } from "express";
import * as fs from "fs";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "path";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { aiController } from "./ai.controller";

const router = Router();

// Reusing multer config pattern from upload module
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `ai-${Date.now()}-${nanoid(8)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG and WebP are allowed"));
    }
  },
});

// POST /v1/ai/analyze-item
router.post(
  "/analyze-item",
  authMiddleware,
  upload.single("image"),
  aiController.analyzeImage
);

export default router;
