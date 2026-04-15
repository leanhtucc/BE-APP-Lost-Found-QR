import { prisma } from "../../libs/prisma"; // assuming a prisma client export
import { NearbyMapItemPublic, NearbyMapQuery } from "./map.types";

/**
 * Perform a Haversine distance query to find lost items within radius.
 * Uses raw SQL because Prisma does not support spatial functions directly.
 */
export async function findNearbyLostItems(
  query: NearbyMapQuery
): Promise<NearbyMapItemPublic[]> {
  const { lat, lng, radius = 5000 } = query;
  // Earth radius in metres
  const earthRadius = 6371000;
  const sql = `
    SELECT
      i."itemId" as "itemId",
      i."name" as "name",
      i."category" as "category",
      i."status" as "status",
      i."lostMessage" as "lostMessage",
      i."imagePublicUrl" as "imagePublicUrl",
      i."lostLat" as "lostLat",
      i."lostLng" as "lostLng",
      u."displayName" as "ownerDisplayName",
      u."photoURL" as "ownerPhotoURL",
      ${earthRadius} * acos(
        cos(radians($1)) * cos(radians(i."lostLat")) *
        cos(radians(i."lostLng") - radians($2)) +
        sin(radians($1)) * sin(radians(i."lostLat"))
      ) as "distanceMetres"
    FROM "Item" i
    JOIN "User" u ON u."id" = i."ownerId"
    WHERE i."status" = 'lost'
      AND i."lostLat" IS NOT NULL
      AND i."lostLng" IS NOT NULL
      AND ${earthRadius} * acos(
        cos(radians($1)) * cos(radians(i."lostLat")) *
        cos(radians(i."lostLng") - radians($2)) +
        sin(radians($1)) * sin(radians(i."lostLat"))
      ) <= $3
    ORDER BY "distanceMetres" ASC
    LIMIT 100;
  `;
  const rows = await prisma.$queryRawUnsafe(sql, lat, lng, radius);
  // Prisma returns any[]; map to NearbyItem
  return (rows as any[]).map(
    (row): NearbyMapItemPublic => ({
      itemId: row.itemId,
      name: row.name,
      category: row.category,
      status: row.status,
      lostMessage: row.lostMessage ?? null,
      imagePublicUrl: row.imagePublicUrl ?? null,
      latitude: Number(row.lostLat),
      longitude: Number(row.lostLng),
      distanceMeters: Number(row.distanceMetres),
      reportedAt: row.updatedAt
        ? new Date(row.updatedAt).toISOString()
        : new Date().toISOString(),
      ownerDisplayName: row.ownerDisplayName ?? "",
      ownerPhotoURL: row.ownerPhotoURL ?? null,
    })
  );
}
