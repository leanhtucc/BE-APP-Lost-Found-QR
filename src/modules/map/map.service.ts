import { countActiveUsersNear, findNearbyLostItems } from "./map.repository";
import { NearbyMapItemPublic, NearbyMapQuery } from "./map.types";

export class MapService {
  async getNearby(query: NearbyMapQuery): Promise<NearbyMapItemPublic[]> {
    // Validation already done by schema
    return await findNearbyLostItems(query);
  }

  async countActiveUsers(
    lat: number,
    lng: number,
    radius: number
  ): Promise<number> {
    return await countActiveUsersNear(lat, lng, radius);
  }
}

export const mapService = new MapService();
