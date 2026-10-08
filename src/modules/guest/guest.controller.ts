import { NextFunction, Request, Response } from "express";
import { guestService } from "./guest.service";

export class GuestController {
  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await guestService.refresh(req.guest!);
      res.json({
        success: true,
        data: {
          guestAccessToken: result.token,
          guestAccessExpiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
  streamToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await guestService.createStreamToken(req.guest!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const guestController = new GuestController();
