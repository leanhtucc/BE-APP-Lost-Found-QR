import { Prisma } from "@prisma/client";
import { prisma } from "../../libs/prisma";
import { NearbyLostItemRow } from "./map.types";

export class MapRepository {
  async findNearbyLostItems(params: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit: number;
    geohashCells: string[];
  }): Promise<NearbyLostItemRow[]> {
    const targetPoint = Prisma.sql`ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography`;

    const geohashFilter =
      params.geohashCells.length > 0
        ? Prisma.sql`AND i."location_geohash" IN (${Prisma.join(params.geohashCells)})`
        : Prisma.sql``;

    const rows = await prisma.$queryRaw<NearbyLostItemRow[]>(Prisma.sql`
      SELECT
        i.id,
        i."itemId",
        i.name,
        i.category,
        i.description,
        i."lostMessage",
        i."imagePublicUrl",
        i.latitude,
        i.longitude,
        i."updatedAt",
        ST_Distance(i."location", ${targetPoint}) AS distance_meters
      FROM "Item" i
      WHERE i.status = 'lost'
        AND i."location" IS NOT NULL
        ${geohashFilter}
        AND ST_DWithin(i."location", ${targetPoint}, ${params.radiusMeters})
      ORDER BY distance_meters ASC
      LIMIT ${params.limit};
    `);

    return rows;
  }
}
