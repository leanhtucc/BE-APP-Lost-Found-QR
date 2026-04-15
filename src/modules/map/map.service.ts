import { findNearbyLostItems } from "./map.repository";
import { NearbyMapItemPublic, NearbyMapQuery } from "./map.types";

export class MapService {
  async getNearby(query: NearbyMapQuery): Promise<NearbyMapItemPublic[]> {
    // Validation already done by schema
    return await findNearbyLostItems(query);
  }
}

export const mapService = new MapService();
