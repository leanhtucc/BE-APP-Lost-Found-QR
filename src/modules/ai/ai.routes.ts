import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { aiController } from "./ai.controller";
import {
  conversationParamsSchema,
  createConversationSchema,
  sendAiMessageSchema,
} from "./ai.schema";

const router = Router();

// Reusing multer config pattern from upload module
const upload = multer({
  storage: multer.memoryStorage(),
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

router.post(
  "/conversations",
  authMiddleware,
  validate(createConversationSchema),
  aiController.createConversation
);
router.get("/conversations", authMiddleware, aiController.listConversations);
router.get(
  "/conversations/:conversationId/messages",
  authMiddleware,
  validate(conversationParamsSchema),
  aiController.getMessages
);
router.post(
  "/conversations/:conversationId/messages",
  authMiddleware,
  validate(sendAiMessageSchema),
  aiController.sendMessage
);
router.delete(
  "/conversations/:conversationId",
  authMiddleware,
  validate(conversationParamsSchema),
  aiController.deleteConversation
);

export default router;
