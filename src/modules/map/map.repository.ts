import { ItemStatus, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../libs/prisma";
import { NearbyMapItemPublic, NearbyMapQuery } from "./map.types";

/**
 * Perform a Haversine distance query to find lost items within radius.
 * Uses raw SQL because Prisma does not support spatial functions directly.
 */
export async function findNearbyLostItems(
  query: NearbyMapQuery
): Promise<NearbyMapItemPublic[]> {
  const { lat, lng, radius = 5000, limit = 100 } = query;
  const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
  const rows = await prisma.$queryRaw<
    Array<{
      itemId: string;
      name: string;
      category: string;
      status: ItemStatus;
      lostMessage: string | null;
      imagePublicUrl: string | null;
      latitude: number;
      longitude: number;
      updatedAt: Date;
      ownerDisplayName: string;
      ownerPhotoURL: string | null;
      distanceMetres: number;
    }>
  >(Prisma.sql`
    SELECT
      i."itemId" as "itemId",
      i."name" as "name",
      i."category" as "category",
      i."status" as "status",
      i."lostMessage" as "lostMessage",
      i."imagePublicUrl" as "imagePublicUrl",
      ST_Y(i."location"::geometry) as "latitude",
      ST_X(i."location"::geometry) as "longitude",
      i."updatedAt" as "updatedAt",
      u."displayName" as "ownerDisplayName",
      u."photoURL" as "ownerPhotoURL",
      ST_Distance(i."location", ${point}) as "distanceMetres"
    FROM "Item" i
    JOIN "User" u ON u."id" = i."ownerId"
    WHERE i."status" = ${ItemStatus.LOST}::"ItemStatus"
      AND i."location" IS NOT NULL
      AND ST_DWithin(i."location", ${point}, ${radius})
    ORDER BY i."location" <-> ${point}
    LIMIT ${Math.min(limit, 100)};
  `);

  return rows.map((row): NearbyMapItemPublic => ({
    itemId: row.itemId,
    name: row.name,
    category: row.category,
    status: row.status,
    lostMessage: row.lostMessage ?? null,
    imagePublicUrl: row.imagePublicUrl ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMeters: Number(row.distanceMetres),
    reportedAt: row.updatedAt
      ? new Date(row.updatedAt).toISOString()
      : new Date().toISOString(),
    ownerDisplayName: row.ownerDisplayName ?? "",
    ownerPhotoURL: row.ownerPhotoURL ?? null,
  }));
}

/**
 * Perform a Haversine distance query to count active users within radius
 */
export async function countActiveUsersNear(
  lat: number,
  lng: number,
  radius: number = 2000
): Promise<number> {
  const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT count(*) as count
    FROM "UserLocation"
    WHERE "updatedAt" >= NOW() - INTERVAL '1 hour'
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography,
        ${point},
        ${radius}
      )
  `);
  return Number(rows[0]?.count || 0);
}
