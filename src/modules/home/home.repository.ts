import { prisma } from "../../libs/prisma";
import { LostFeedCard, LostFeedPin, LostFeedQuery } from "./home.types";

const EARTH_RADIUS = 6371000; // metres
const MAX_NEARBY_CANDIDATES = 300;
const MAX_NEARBY_RESULTS = 100;

type RawLostFeedRow = {
  itemId: string;
  name: string;
  category: string;
  imagePublicUrl: string | null;
  lostMessage: string | null;
  lostLat: number | string | null;
  lostLng: number | string | null;
  lostAddress: string | null;
  lastSeenLocation: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  updatedAt: Date | string | null;
  ownerDisplayName: string | null;
  ownerPhotoURL: string | null;
};

type NearbyCandidate = {
  row: RawLostFeedRow;
  coordinates: { lat: number; lng: number };
  distanceMeters: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCoordinates(
  row: RawLostFeedRow
): { lat: number; lng: number } | null {
  const lostLat = toFiniteNumber(row.lostLat);
  const lostLng = toFiniteNumber(row.lostLng);
  if (lostLat !== null && lostLng !== null) {
    return { lat: lostLat, lng: lostLng };
  }

  const radarLat = toFiniteNumber(row.latitude);
  const radarLng = toFiniteNumber(row.longitude);
  if (radarLat !== null && radarLng !== null) {
    return { lat: radarLat, lng: radarLng };
  }

  if (typeof row.lastSeenLocation === "string" && row.lastSeenLocation.trim()) {
    try {
      const parsed = JSON.parse(row.lastSeenLocation) as {
        lat?: unknown;
        lng?: unknown;
      };

      const fallbackLat = toFiniteNumber(parsed.lat);
      const fallbackLng = toFiniteNumber(parsed.lng);
      if (fallbackLat !== null && fallbackLng !== null) {
        return { lat: fallbackLat, lng: fallbackLng };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function calculateDistanceMeters(
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number
): number {
  const phi1 = (originLat * Math.PI) / 180;
  const phi2 = (targetLat * Math.PI) / 180;
  const deltaLambda = ((targetLng - originLng) * Math.PI) / 180;

  return (
    EARTH_RADIUS *
    Math.acos(
      Math.min(
        1,
        Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda) +
          Math.sin(phi1) * Math.sin(phi2)
      )
    )
  );
}

function formatDistance(metres: number | null): string | null {
  if (metres === null) return null;
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}

function toIsoString(value: Date | string | null): string {
  if (!value) return new Date().toISOString();

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function toTimestamp(value: Date | string | null): number {
  if (!value) return 0;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * Single query that returns the user's own lost items UNION with
 * nearby lost items from other users (when lat/lng provided).
 */
export async function fetchLostFeed(
  userId: string,
  query: LostFeedQuery
): Promise<{ cards: LostFeedCard[]; pins: LostFeedPin[] }> {
  const { lat, lng, radius = 5000 } = query;
  const hasLocation = lat !== undefined && lng !== undefined;
  const effectiveRadius =
    typeof radius === "number" && Number.isFinite(radius) && radius > 0
      ? radius
      : 5000;

  // ── Part 1: own lost items (always fetched) ──────────────────────────
  // Lấy danh sách đồ đã mất của chính User để hiển thị lên Map & Feed
  const sqlOwn = `
    SELECT
      i."itemId",
      i."name",
      i."category",
      i."imagePublicUrl",
      i."lostMessage",
      i."lostLat",
      i."lostLng",
      i."lostAddress",
      i."lastSeenLocation",
      i."latitude",
      i."longitude",
      i."updatedAt",
      u."displayName" as "ownerDisplayName",
      u."photoURL"    as "ownerPhotoURL"
    FROM "Item" i
    JOIN "User" u ON u."id" = i."ownerId"
    WHERE UPPER(i."status") = 'LOST'
      AND i."ownerId" = $1
    ORDER BY i."updatedAt" DESC;
  `;
  const ownItems = (await prisma.$queryRawUnsafe(
    sqlOwn,
    userId
  )) as RawLostFeedRow[];

  // ── Part 2: nearby lost items from others (only when location given) ──
  const sqlNearby = `
    SELECT
      i."itemId",
      i."name",
      i."category",
      i."imagePublicUrl",
      i."lostMessage",
      i."lostLat",
      i."lostLng",
      i."lostAddress",
      i."lastSeenLocation",
      i."latitude",
      i."longitude",
      i."updatedAt",
      u."displayName" as "ownerDisplayName",
      u."photoURL"    as "ownerPhotoURL"
    FROM "Item" i
    JOIN "User" u ON u."id" = i."ownerId"
    WHERE UPPER(i."status") = 'LOST'
      AND i."ownerId" != $1
    ORDER BY i."updatedAt" DESC
    LIMIT ${MAX_NEARBY_CANDIDATES};
  `;
  const nearbyRows = (await prisma.$queryRawUnsafe(
    sqlNearby,
    userId
  )) as RawLostFeedRow[];

  // ── Build cards ───────────────────────────────────────────────────────
  const ownCards: LostFeedCard[] = ownItems.map((item) => {
    const coordinates = extractCoordinates(item);
    const distanceMeters =
      hasLocation && coordinates
        ? Math.round(
            calculateDistanceMeters(
              lat!,
              lng!,
              coordinates.lat,
              coordinates.lng
            )
          )
        : null;

    return {
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      imagePublicUrl: item.imagePublicUrl ?? null,
      lostMessage: item.lostMessage ?? null,
      distanceMeters,
      distanceLabel: formatDistance(distanceMeters),
      lostLat: coordinates?.lat ?? null,
      lostLng: coordinates?.lng ?? null,
      address: item.lostAddress ?? null,
      isOwn: true,
      ownerDisplayName: item.ownerDisplayName ?? "",
      ownerPhotoURL: item.ownerPhotoURL ?? null,
      reportedAt: toIsoString(item.updatedAt),
    };
  });

  const nearbyCandidates = nearbyRows
    .map((row): NearbyCandidate | null => {
      const coordinates = extractCoordinates(row);
      if (!coordinates) return null;

      const distanceMeters = hasLocation
        ? Math.round(
            calculateDistanceMeters(
              lat!,
              lng!,
              coordinates.lat,
              coordinates.lng
            )
          )
        : null;

      if (
        hasLocation &&
        distanceMeters !== null &&
        distanceMeters > effectiveRadius
      ) {
        return null;
      }

      return {
        row,
        coordinates,
        distanceMeters,
      };
    })
    .filter(isNotNull);

  if (hasLocation) {
    nearbyCandidates.sort((a, b) => {
      const left = a.distanceMeters ?? Number.MAX_SAFE_INTEGER;
      const right = b.distanceMeters ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    });
  } else {
    nearbyCandidates.sort(
      (a, b) => toTimestamp(b.row.updatedAt) - toTimestamp(a.row.updatedAt)
    );
  }

  const nearbyCards: LostFeedCard[] = nearbyCandidates
    .slice(0, MAX_NEARBY_RESULTS)
    .map(({ row, coordinates, distanceMeters }) => ({
      itemId: row.itemId,
      name: row.name,
      category: row.category,
      imagePublicUrl: row.imagePublicUrl ?? null,
      lostMessage: row.lostMessage ?? null,
      distanceMeters,
      distanceLabel: formatDistance(distanceMeters),
      lostLat: coordinates.lat,
      lostLng: coordinates.lng,
      address: row.lostAddress ?? null,
      isOwn: false,
      ownerDisplayName: row.ownerDisplayName ?? "",
      ownerPhotoURL: row.ownerPhotoURL ?? null,
      reportedAt: toIsoString(row.updatedAt),
    }));

  // Merge: own items first, then nearby sorted by distance
  const allCards = [...ownCards, ...nearbyCards];

  // ── Build pins (only items with coordinates) ──────────────────────────
  const pins: LostFeedPin[] = allCards
    .filter((c) => c.lostLat != null && c.lostLng != null)
    .map((c) => ({
      itemId: c.itemId,
      lat: c.lostLat!,
      lng: c.lostLng!,
      isOwn: c.isOwn,
    }));

  return { cards: allCards, pins };
}
