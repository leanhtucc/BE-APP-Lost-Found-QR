import { NextFunction, Request, Response } from "express";
import { radarService } from "./radar.service";

export class RadarController {
  // POST /v1/radar/simulate
  simulate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await radarService.simulate({
        lat: req.body.lat,
        lng: req.body.lng,
        radius: req.body.radius,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const radarController = new RadarController();
