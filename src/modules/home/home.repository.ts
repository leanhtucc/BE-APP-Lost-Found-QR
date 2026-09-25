import { ItemStatus, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../libs/prisma";
import {
  HOME_LOST_FEED_LIMIT,
  HOME_LOST_RADIUS_METERS,
} from "../../utils/constants";
import { LostFeedCard, LostFeedPin, LostFeedQuery } from "./home.types";

type RawLostFeedRow = {
  itemId: string;
  ownerId: string;
  name: string;
  category: string;
  imagePublicUrl: string | null;
  lostMessage: string | null;
  lostAddress: string | null;
  lostLat: number | string;
  lostLng: number | string;
  distanceMeters: number | string;
  locationUpdatedAt: Date | string | null;
  updatedAt: Date | string;
  ownerDisplayName: string | null;
  ownerPhotoURL: string | null;
};

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}

function toIsoString(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date(0).toISOString()
    : date.toISOString();
}

/**
 * Return only LOST items whose canonical PostGIS point is within the fixed
 * Home radar. Owner identity decorates the response; it never filters a row.
 */
export async function fetchLostFeed(
  userId: string | undefined,
  query: LostFeedQuery
): Promise<{ cards: LostFeedCard[]; pins: LostFeedPin[] }> {
  const effectiveRadius = Math.min(
    Math.max(query.radius, 1),
    HOME_LOST_RADIUS_METERS
  );
  const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography`;

  const rows = await prisma.$queryRaw<RawLostFeedRow[]>(Prisma.sql`
    SELECT
      i."itemId" AS "itemId",
      i."ownerId" AS "ownerId",
      i."name" AS "name",
      i."category" AS "category",
      i."imagePublicUrl" AS "imagePublicUrl",
      i."lostMessage" AS "lostMessage",
      i."lostAddress" AS "lostAddress",
      ST_Y(i."location"::geometry) AS "lostLat",
      ST_X(i."location"::geometry) AS "lostLng",
      ST_Distance(i."location", ${point}) AS "distanceMeters",
      i."location_updated_at" AS "locationUpdatedAt",
      i."updatedAt" AS "updatedAt",
      u."displayName" AS "ownerDisplayName",
      u."photoURL" AS "ownerPhotoURL"
    FROM "Item" i
    JOIN "User" u ON u."id" = i."ownerId"
    WHERE i."status" = ${ItemStatus.LOST}::"ItemStatus"
      AND i."location" IS NOT NULL
      AND ST_DWithin(i."location", ${point}, ${effectiveRadius})
      ${query.category ? Prisma.sql`AND i."category" = ${query.category}` : Prisma.empty}
    ORDER BY
      ST_Distance(i."location", ${point}) ASC,
      COALESCE(i."location_updated_at", i."updatedAt") DESC,
      i."itemId" ASC
    LIMIT ${HOME_LOST_FEED_LIMIT};
  `);

  const cards: LostFeedCard[] = rows.map((row) => {
    const distanceMeters = Math.round(Number(row.distanceMeters));
    const lostLat = Number(row.lostLat);
    const lostLng = Number(row.lostLng);

    return {
      itemId: row.itemId,
      name: row.name,
      category: row.category,
      imagePublicUrl: row.imagePublicUrl ?? null,
      lostMessage: row.lostMessage ?? null,
      distanceMeters,
      distanceLabel: formatDistance(distanceMeters),
      lostLat,
      lostLng,
      address: row.lostAddress ?? null,
      isOwn: Boolean(userId && row.ownerId === userId),
      ownerDisplayName: row.ownerDisplayName ?? "",
      ownerPhotoURL: row.ownerPhotoURL ?? null,
      reportedAt: toIsoString(row.locationUpdatedAt ?? row.updatedAt),
    };
  });

  // Every row has a canonical point, so cards and pins are intentionally 1:1.
  const pins: LostFeedPin[] = cards.map((card) => ({
    itemId: card.itemId,
    lat: card.lostLat!,
    lng: card.lostLng!,
    isOwn: card.isOwn,
  }));

  return { cards, pins };
}

/** Global LOST count for the authenticated user's vault badge. */
export async function countOwnLostItems(userId: string): Promise<number> {
  return prisma.item.count({
    where: { ownerId: userId, status: ItemStatus.LOST },
  });
}
