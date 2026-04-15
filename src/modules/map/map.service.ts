import { AppError } from "../../middlewares/error.middleware";
import {
  getGeoHashCellsCoveringRadius,
  getGeoHashPrecisionForRadius,
} from "../../utils/geospatial";
import { MapRepository } from "./map.repository";
import { NearbyMapQuery, NearbyMapResponse } from "./map.types";

const DEFAULT_RADIUS_METERS = 3000;
const DEFAULT_LIMIT = 50;

const mapRepository = new MapRepository();

export class MapService {
  async getNearbyLostItems(query: NearbyMapQuery): Promise<NearbyMapResponse> {
    this.validateQuery(query);

    const precision = getGeoHashPrecisionForRadius(query.radius);
    const geohashCells = getGeoHashCellsCoveringRadius(
      query.lat,
      query.lng,
      query.radius,
      precision
    );

    const rows = await mapRepository.findNearbyLostItems({
      lat: query.lat,
      lng: query.lng,
      radiusMeters: query.radius,
      limit: query.limit,
      geohashCells,
    });

    const items = rows
      .filter((row) => row.latitude !== null && row.longitude !== null)
      .map((row) => ({
        id: row.id,
        itemId: row.itemId,
        name: row.name,
        category: row.category,
        description: row.description || undefined,
        lostMessage: row.lostMessage || undefined,
        imagePublicUrl: row.imagePublicUrl || undefined,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        distanceMeters: Math.round(Number(row.distance_meters)),
        reportedAt: new Date(row.updatedAt).toISOString(),
      }));

    return {
      items,
      total: items.length,
    };
  }

  parseNearbyQuery(rawQuery: any): NearbyMapQuery {
    const radius = rawQuery.radius
      ? Number(rawQuery.radius)
      : DEFAULT_RADIUS_METERS;
    const limit = rawQuery.limit ? Number(rawQuery.limit) : DEFAULT_LIMIT;

    return {
      lat: Number(rawQuery.lat),
      lng: Number(rawQuery.lng),
      radius,
      limit,
    };
  }

  private validateQuery(query: NearbyMapQuery) {
    if (!Number.isFinite(query.lat) || query.lat < -90 || query.lat > 90) {
      throw new AppError("Invalid latitude", 400);
    }

    if (!Number.isFinite(query.lng) || query.lng < -180 || query.lng > 180) {
      throw new AppError("Invalid longitude", 400);
    }

    if (
      !Number.isFinite(query.radius) ||
      query.radius < 100 ||
      query.radius > 20000
    ) {
      throw new AppError("Radius must be between 100 and 20000 meters", 400);
    }

    if (
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 200
    ) {
      throw new AppError("Limit must be between 1 and 200", 400);
    }
  }
}

export const mapService = new MapService();
