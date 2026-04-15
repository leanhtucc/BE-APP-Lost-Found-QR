import { NextFunction, Request, Response } from "express";
import { mapService } from "./map.service";

export class MapController {
  getNearby = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radius = req.query.radius ? Number(req.query.radius) : undefined;
      const result = await mapService.getNearby({ lat, lng, radius });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const mapController = new MapController();
