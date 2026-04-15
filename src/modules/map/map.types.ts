export interface NearbyMapQuery {
  lat: number;
  lng: number;
  radius: number;
  limit: number;
}

export interface NearbyLostItemRow {
  id: string;
  itemId: string;
  name: string;
  category: string;
  description: string | null;
  lostMessage: string | null;
  imagePublicUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: Date;
  distance_meters: number;
}

export interface NearbyMapItemPublic {
  id: string;
  itemId: string;
  name: string;
  category: string;
  description?: string;
  lostMessage?: string;
  imagePublicUrl?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  reportedAt: string;
}

export interface NearbyMapResponse {
  items: NearbyMapItemPublic[];
  total: number;
}
