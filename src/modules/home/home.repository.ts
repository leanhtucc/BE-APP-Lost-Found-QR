import { prisma } from "../../libs/prisma";
import { LostFeedCard, LostFeedPin, LostFeedQuery } from "./home.types";

const EARTH_RADIUS = 6371000; // metres

function haversineExpr(latParam: number, lngParam: number) {
  return `${EARTH_RADIUS} * acos(
    LEAST(1.0, cos(radians(${latParam})) * cos(radians(i."lostLat")) *
    cos(radians(i."lostLng") - radians(${lngParam})) +
    sin(radians(${latParam})) * sin(radians(i."lostLat")))
  )`;
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
      i."updatedAt",
      u."displayName" as "ownerDisplayName",
      u."photoURL"    as "ownerPhotoURL"
    FROM "Item" i
    JOIN "User" u ON u."id" = i."ownerId"
    WHERE i."status" = 'LOST'
      AND i."ownerId" = $1
      AND i."lostLat" IS NOT NULL
      AND i."lostLng" IS NOT NULL
    ORDER BY i."updatedAt" DESC;
  `;
  const ownItems = (await prisma.$queryRawUnsafe(sqlOwn, userId)) as any[];


  // ── Part 2: nearby lost items from others (only when location given) ──
  let nearbyRows: any[] = [];
  if (hasLocation) {
    const sql = `
      SELECT
        i."itemId",
        i."name",
        i."category",
        i."imagePublicUrl",
        i."lostMessage",
        i."lostLat",
        i."lostLng",
        i."lostAddress",
        i."updatedAt",
        u."displayName" as "ownerDisplayName",
        u."photoURL"    as "ownerPhotoURL",
        ${haversineExpr(lat!, lng!)} AS "distanceMetres"
      FROM "Item" i
      JOIN "User" u ON u."id" = i."ownerId"
      WHERE i."status" = 'LOST'
        AND i."ownerId" != $1
        AND i."lostLat" IS NOT NULL
        AND i."lostLng" IS NOT NULL
      ORDER BY "distanceMetres" ASC
      LIMIT 100;
    `;
    nearbyRows = (await prisma.$queryRawUnsafe(sql, userId)) as any[];
  } else {
    // Mặc định trả về đồ án mới nhất toàn cầu nếu User chưa cấp quyền Location
    const sql = `
      SELECT
        i."itemId",
        i."name",
        i."category",
        i."imagePublicUrl",
        i."lostMessage",
        i."lostLat",
        i."lostLng",
        i."lostAddress",
        i."updatedAt",
        u."displayName" as "ownerDisplayName",
        u."photoURL"    as "ownerPhotoURL",
        NULL AS "distanceMetres"
      FROM "Item" i
      JOIN "User" u ON u."id" = i."ownerId"
      WHERE i."status" = 'LOST'
        AND i."ownerId" != $1
        AND i."lostLat" IS NOT NULL
        AND i."lostLng" IS NOT NULL
      ORDER BY i."updatedAt" DESC
      LIMIT 100;
    `;
    nearbyRows = (await prisma.$queryRawUnsafe(sql, userId)) as any[];
  }

  // ── Format distance label ─────────────────────────────────────────────
  function formatDistance(metres: number | null): string | null {
    if (metres === null) return null;
    if (metres < 1000) return `${Math.round(metres)}m`;
    return `${(metres / 1000).toFixed(1)}km`;
  }

  // ── Build cards ───────────────────────────────────────────────────────
  const ownCards: LostFeedCard[] = ownItems.map((item) => {
    // Calculate distance if location known
    let distanceMeters: number | null = null;
    if (hasLocation && item.lostLat != null && item.lostLng != null) {
      const φ1 = (lat! * Math.PI) / 180;
      const φ2 = (item.lostLat * Math.PI) / 180;
      const Δλ = ((item.lostLng - lng!) * Math.PI) / 180;
      distanceMeters =
        EARTH_RADIUS *
        Math.acos(
          Math.min(
            1,
            Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ) +
              Math.sin(φ1) * Math.sin(φ2)
          )
        );
    }

    return {
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      imagePublicUrl: item.imagePublicUrl ?? null,
      lostMessage: item.lostMessage ?? null,
      distanceMeters:
        distanceMeters !== null ? Math.round(distanceMeters) : null,
      distanceLabel: formatDistance(distanceMeters),
      lostLat: item.lostLat ?? null,
      lostLng: item.lostLng ?? null,
      address: item.lostAddress ?? null,
      isOwn: true,
      ownerDisplayName: item.ownerDisplayName ?? "",
      ownerPhotoURL: item.ownerPhotoURL ?? null,
      reportedAt: item.updatedAt
        ? new Date(item.updatedAt).toISOString()
        : new Date().toISOString(),
    };
  });

  const nearbyCards: LostFeedCard[] = nearbyRows.map((row) => ({
    itemId: row.itemId,
    name: row.name,
    category: row.category,
    imagePublicUrl: row.imagePublicUrl ?? null,
    lostMessage: row.lostMessage ?? null,
    distanceMeters:
      row.distanceMetres != null ? Math.round(Number(row.distanceMetres)) : null,
    distanceLabel: formatDistance(
      row.distanceMetres != null ? Number(row.distanceMetres) : null
    ),
    lostLat: Number(row.lostLat),
    lostLng: Number(row.lostLng),
    address: row.lostAddress ?? null,
    isOwn: false,
    ownerDisplayName: row.ownerDisplayName ?? "",
    ownerPhotoURL: row.ownerPhotoURL ?? null,
    reportedAt: row.updatedAt
      ? new Date(row.updatedAt).toISOString()
      : new Date().toISOString(),
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
