import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { aiService } from "./ai.service";

export class AIController {
  analyzeImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError("No image file provided", 400);
      }

      const result = await aiService.analyzeImage(req.file);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const aiController = new AIController();
