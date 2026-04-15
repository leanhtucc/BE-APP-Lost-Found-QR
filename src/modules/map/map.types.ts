export interface NearbyMapQuery {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
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
  itemId: string;
  name: string;
  category: string;
  status: string;
  lostMessage: string | null;
  imagePublicUrl: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  reportedAt: string;
  ownerDisplayName: string;
  ownerPhotoURL: string | null;
}

export interface NearbyMapResponse {
  items: NearbyMapItemPublic[];
  total: number;
}
