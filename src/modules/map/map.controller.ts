import { NextFunction, Request, Response } from "express";
import { mapService } from "./map.service";

export class MapController {
  getNearby = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radius = req.query.radius ? Number(req.query.radius) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const result = await mapService.getNearby({ lat, lng, radius, limit });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  countActiveUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radius = req.query.radius ? Number(req.query.radius) : 2000;
      const count = await mapService.countActiveUsers(lat, lng, radius);
      res.json({ success: true, data: { active_users_count: count } });
    } catch (err) {
      next(err);
    }
  };

  autocomplete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = String(req.query.input || req.query.q || req.query.query || "");
      const lat = req.query.lat ? Number(req.query.lat) : undefined;
      const lng = req.query.lng ? Number(req.query.lng) : undefined;
      const radius = req.query.radius ? Number(req.query.radius) : undefined;
      const sessionToken = req.query.sessiontoken ? String(req.query.sessiontoken) : undefined;

      const predictions = await mapService.autocomplete(input, {
        lat,
        lng,
        radius,
        sessionToken,
      });

      res.json({ success: true, data: predictions });
    } catch (err) {
      next(err);
    }
  };

  getPlaceDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const placeId = String(req.query.place_id || req.query.placeId || "");
      const sessionToken = req.query.sessiontoken ? String(req.query.sessiontoken) : undefined;

      const details = await mapService.getPlaceDetails(placeId, sessionToken);
      if (!details) {
        return res.status(404).json({
          success: false,
          error: { code: "PLACE_NOT_FOUND", message: "Place not found" },
        });
      }

      res.json({ success: true, data: details });
    } catch (err) {
      next(err);
    }
  };

  reverseGeocode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);

      const result = await mapService.reverseGeocode(lat, lng);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: { code: "LOCATION_NOT_FOUND", message: "Location not found" },
        });
      }

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  geocode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = String(req.query.address || req.query.q || req.query.query || "");

      const result = await mapService.geocode(address);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" },
        });
      }

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const mapController = new MapController();

