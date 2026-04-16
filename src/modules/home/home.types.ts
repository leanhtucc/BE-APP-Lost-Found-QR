/**
 * Home Module Types
 * Data contract for the unified Home Screen lost-feed API.
 */

export interface LostFeedQuery {
  lat?: number;
  lng?: number;
  radius?: number; // metres, default 5000
}

/** Lightweight pin for map radar rendering */
export interface LostFeedPin {
  itemId: string;
  lat: number;
  lng: number;
  isOwn: boolean;
}

/** Full card for Bottom Sheet rendering */
export interface LostFeedCard {
  itemId: string;
  name: string;
  category: string;
  imagePublicUrl: string | null;
  lostMessage: string | null;
  /** null when item has no lostLat/lostLng */
  distanceMeters: number | null;
  /** Human-readable label e.g. "700m", "1.2km", null */
  distanceLabel: string | null;
  lostLat: number | null;
  lostLng: number | null;
  isOwn: boolean;
  ownerDisplayName: string;
  ownerPhotoURL: string | null;
  reportedAt: string;
}

export interface LostFeedResponse {
  pins: LostFeedPin[];
  cards: LostFeedCard[];
  myLostCount: number;
  nearbyCount: number;
}
