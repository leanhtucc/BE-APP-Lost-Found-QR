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

export interface PlaceAutocompletePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

export interface PlaceDetailsResult {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  formatted_address: string;
  lat: number;
  lng: number;
  place_id?: string;
  name?: string;
}
