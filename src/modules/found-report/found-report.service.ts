import { z } from "zod";
import { prisma } from "../../libs/prisma";
import { foundReportBody } from "./found-report.schema";
import { LostFeedCard, LostFeedQuery } from "../home/home.types";
import {
  calculateBoundingBox,
  haversineDistanceMeters,
} from "../../utils/geospatial";
import { HOME_LOST_RADIUS_METERS } from "../../utils/constants";

const publicSelect = {
  id: true,
  name: true,
  category: true,
  description: true,
  imagePublicUrl: true,
  lat: true,
  lng: true,
  address: true,
  createdAt: true,
  resolvedAt: true,
} as const;

export async function createFoundReport(
  finderId: string,
  input: z.infer<typeof foundReportBody>
) {
  const body = foundReportBody.parse(input);
  // Atomic upsert makes retries after a dropped response return the same report.
  return prisma.foundReport.upsert({
    where: {
      finderId_idempotencyKey: {
        finderId,
        idempotencyKey: body.idempotencyKey,
      },
    },
    update: {},
    create: {
      finderId,
      idempotencyKey: body.idempotencyKey,
      name: body.name,
      category: body.category,
      description: body.description,
      imagePublicUrl: body.imagePublicUrl,
      ...body.location,
    },
    select: publicSelect,
  });
}

export async function getFoundReport(id: string) {
  return prisma.foundReport.findUnique({ where: { id }, select: publicSelect });
}

export async function getFoundFeed(
  userId: string | undefined,
  query: LostFeedQuery
): Promise<LostFeedCard[]> {
  // Validate coordinates: must be finite and within valid geographic bounds
  if (
    typeof query.lat !== "number" ||
    !Number.isFinite(query.lat) ||
    query.lat < -90 ||
    query.lat > 90 ||
    typeof query.lng !== "number" ||
    !Number.isFinite(query.lng) ||
    query.lng < -180 ||
    query.lng > 180
  ) {
    return [];
  }

  const effectiveRadius = Math.min(
    Math.max(query.radius ?? 5000, 1),
    HOME_LOST_RADIUS_METERS
  );

  // Compute bounding box for database index prefiltering
  const bbox = calculateBoundingBox(query.lat, query.lng, effectiveRadius);
  const select = { ...publicSelect, finderId: true };

  const [own, nearby] = await Promise.all([
    userId
      ? prisma.foundReport.findMany({
          where: {
            finderId: userId,
            resolvedAt: null,
            ...(query.category ? { category: query.category } : {}),
          },
          select,
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [],
    prisma.foundReport.findMany({
      where: {
        resolvedAt: null,
        ...(userId ? { finderId: { not: userId } } : {}),
        lat: { gte: bbox.minLat, lte: bbox.maxLat },
        lng: { gte: bbox.minLng, lte: bbox.maxLng },
        ...(query.category ? { category: query.category } : {}),
      },
      select,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const cards: LostFeedCard[] = [...own, ...nearby].map((report) => {
    const distance = Math.round(
      haversineDistanceMeters(query.lat, query.lng, report.lat, report.lng)
    );
    return {
      itemId: `found:${report.id}`,
      reportType: "FOUND",
      name: report.name,
      category: report.category,
      imagePublicUrl: report.imagePublicUrl,
      lostMessage: report.description,
      lostLat: report.lat,
      lostLng: report.lng,
      address: report.address,
      distanceMeters: distance,
      distanceLabel:
        distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`,
      isOwn: report.finderId === userId,
      ownerDisplayName: "Người nhặt được",
      ownerPhotoURL: null,
      reportedAt: report.createdAt.toISOString(),
    };
  });

  const ownCards = cards.filter((card) => card.isOwn);
  const publicCards = cards.filter(
    (card) =>
      !card.isOwn &&
      card.distanceMeters !== null &&
      card.distanceMeters <= effectiveRadius
  );
  publicCards.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  return [...ownCards, ...publicCards.slice(0, 100)];
}
