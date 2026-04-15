import { encode as encodeGeohash } from "ngeohash";

type LocationInfo = {
  socketId: string;
  userId: string;
  lat: number;
  lng: number;
  geohash: string;
};

class UserLocationStore {
  private store: Map<string, LocationInfo> = new Map();

  upsert(socketId: string, userId: string, lat: number, lng: number) {
    const geohash = encodeGeohash(lat, lng, 4);
    this.store.set(socketId, { socketId, userId, lat, lng, geohash });
  }

  remove(socketId: string) {
    this.store.delete(socketId);
  }

  getByGeohash(geohash: string): LocationInfo[] {
    return Array.from(this.store.values()).filter(
      (info) => info.geohash === geohash
    );
  }

  getAll(): LocationInfo[] {
    return Array.from(this.store.values());
  }
}

const userLocationStore = new UserLocationStore();
export default userLocationStore;
