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
  const ownItems = await prisma.item.findMany({
    where: { ownerId: userId, status: "lost" },
    select: {
      itemId: true,
      name: true,
      category: true,
      imagePublicUrl: true,
      lostMessage: true,
      lostLat: true,
      lostLng: true,
      updatedAt: true,
      owner: {
        select: { displayName: true, photoURL: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

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
        i."updatedAt",
        u."displayName" as "ownerDisplayName",
        u."photoURL"    as "ownerPhotoURL",
        ${haversineExpr(lat!, lng!)} AS "distanceMetres"
      FROM "Item" i
      JOIN "User" u ON u."id" = i."ownerId"
      WHERE i."status" = 'lost'
        AND i."ownerId" != $1
        AND i."lostLat" IS NOT NULL
        AND i."lostLng" IS NOT NULL
        AND ${haversineExpr(lat!, lng!)} <= $2
      ORDER BY "distanceMetres" ASC
      LIMIT 100;
    `;
    nearbyRows = (await prisma.$queryRawUnsafe(sql, userId, radius)) as any[];
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
      isOwn: true,
      ownerDisplayName: item.owner.displayName,
      ownerPhotoURL: item.owner.photoURL ?? null,
      reportedAt: item.updatedAt.toISOString(),
    };
  });

  const nearbyCards: LostFeedCard[] = nearbyRows.map((row) => ({
    itemId: row.itemId,
    name: row.name,
    category: row.category,
    imagePublicUrl: row.imagePublicUrl ?? null,
    lostMessage: row.lostMessage ?? null,
    distanceMeters: Math.round(Number(row.distanceMetres)),
    distanceLabel: formatDistance(Number(row.distanceMetres)),
    lostLat: Number(row.lostLat),
    lostLng: Number(row.lostLng),
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
