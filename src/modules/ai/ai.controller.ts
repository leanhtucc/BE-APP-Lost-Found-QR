import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { ResponseUtil } from "../../utils/response";
import { aiService } from "./ai.service";
import { uploadService } from "../upload/upload.service";
import { classifyItemCategory } from "../../libs/typesafe";

export class AIController {
  analyzeImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError("No image file provided", 400);
      }

      const userId = req.user!.id;
      const uploaded = await uploadService.uploadImage(req.file, userId);
      let result;

      try {
        result = await aiService.analyzeImage(req.file, uploaded.url);
      } catch (error) {
        await uploadService.deleteFile(uploaded.filename, userId).catch(() => {
          // Keep the original AI error; orphan cleanup can be retried separately.
        });
        throw error;
      }

      res.status(200).json({
        success: true,
        data: {
          ...result,
          filename: uploaded.filename,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Classify a lost/found item by text description using TypeSafe AI (Jev).
   * Returns the suggested category, confidence, and probability distribution.
   */
  classifyItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { description } = req.body as { description: string };
      const result = await classifyItemCategory(description);
      return ResponseUtil.success(res, result, "Item classified successfully");
    } catch (error) {
      next(error);
    }
  };

  createConversation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await aiService.createConversation(
        req.user!.id,
        req.body.title
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  listConversations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await aiService.listConversations(req.user!.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await aiService.getMessages(
        req.user!.id,
        req.params.conversationId!
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await aiService.sendMessage(
        req.user!.id,
        req.params.conversationId!,
        req.body.content
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteConversation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      await aiService.deleteConversation(
        req.user!.id,
        req.params.conversationId!
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

export const aiController = new AIController();
