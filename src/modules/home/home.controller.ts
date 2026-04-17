import { NextFunction, Request, Response } from "express";
import { homeService } from "./home.service";

export class HomeController {
  getLostFeed = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id; // set by authMiddleware
      const lat =
        req.query.lat !== undefined && req.query.lat !== "" ? Number(req.query.lat) : undefined;
      const lng =
        req.query.lng !== undefined && req.query.lng !== "" ? Number(req.query.lng) : undefined;
      const radius =
        req.query.radius !== undefined && req.query.radius !== "" ? Number(req.query.radius) : 50000;

      const data = await homeService.getLostFeed(userId, { lat, lng, radius });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}

export const homeController = new HomeController();
