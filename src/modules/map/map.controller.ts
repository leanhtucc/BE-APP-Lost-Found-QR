import { NextFunction, Request, Response } from "express";
import { ResponseUtil } from "../../utils/response";
import { mapService } from "./map.service";

export class MapController {
  async getNearbyItems(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedQuery = mapService.parseNearbyQuery(req.query);
      const result = await mapService.getNearbyLostItems(parsedQuery);

      return ResponseUtil.success(
        res,
        result,
        "Nearby lost items loaded successfully"
      );
    } catch (error) {
      next(error);
    }
  }
}
