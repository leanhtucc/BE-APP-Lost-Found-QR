import { z } from "zod";
import { prisma } from "../../libs/prisma";
import { foundReportBody } from "./found-report.schema";
import { LostFeedCard, LostFeedQuery } from "../home/home.types";
import {
  calculateBoundingBox,
  haversineDistanceMeters,
} from "../../utils/geospatial";
import { HOME_LOST_RADIUS_METERS } from "../../utils/constants";
import { blurReportLocation } from "../../utils/location-privacy";
import { AppError } from "../../middlewares/error.middleware";
import { nanoid } from "nanoid";
import { createReturnChannel, upsertStreamUser } from "../../libs/stream-chat";
import { logger } from "../../libs/logger";
import { notificationService } from "../notification/notification.service";

function safelyNotify(operation: Promise<unknown>, event: string): void {
  void operation.catch((error) => {
    logger.error(`[FoundReportNotification] ${event} delivery failed`, error);
  });
}

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

export async function getFoundReport(id: string, userId?: string) {
  if (userId) {
    const report = await prisma.foundReport.findUnique({
      where: { id },
      select: { ...publicSelect, finderId: true },
    });
    if (!report) return null;
    const { finderId, ...safe } = report;
    const isOwn = finderId === userId;
    return { ...(isOwn ? safe : blurReportLocation(safe)), isOwn };
  }

  const report = await prisma.foundReport.findUnique({
    where: { id },
    select: publicSelect,
  });
  if (!report) return null;
  return { ...blurReportLocation(report), isOwn: false };
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

  const cards: LostFeedCard[] = [...own, ...nearby].map((rawReport) => {
    // Other people's reports are shown with a blurred location, and the
    // distance is computed from the blurred point so it cannot be used to
    // triangulate the exact spot.
    const isOwn = rawReport.finderId === userId;
    const report = isOwn ? rawReport : blurReportLocation(rawReport);
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

const claimPublicSelect = {
  id: true,
  foundReportId: true,
  claimantId: true,
  ownershipProof: true,
  status: true,
  returnSessionId: true,
  createdAt: true,
  reviewedAt: true,
} as const;

export async function createFoundReportClaim(
  claimantId: string,
  foundReportId: string,
  ownershipProof: string
) {
  const report = await prisma.foundReport.findUnique({
    where: { id: foundReportId },
  });
  if (!report || report.resolvedAt)
    throw new AppError("Found report is not available", 404);
  if (report.finderId === claimantId) {
    throw new AppError("Finder cannot claim their own report", 409);
  }
  const existing = await prisma.foundReportClaim.findUnique({
    where: { foundReportId_claimantId: { foundReportId, claimantId } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "A claim already exists for this found report",
      409,
      true,
      "FOUND_REPORT_CLAIM_ALREADY_EXISTS"
    );
  }
  try {
    const claim = await prisma.foundReportClaim.create({
      data: { foundReportId, claimantId, ownershipProof },
      select: claimPublicSelect,
    });
    safelyNotify(
      notificationService.createNotification({
        receiverId: report.finderId,
        category: "IMPORTANT",
        type: "FOUND_REPORT_CLAIM_SUBMITTED",
        title: { vi: "Có yêu cầu nhận lại đồ", en: "New ownership claim" },
        content: {
          vi: "Một người dùng đã gửi yêu cầu xác nhận quyền sở hữu.",
          en: "A user submitted an ownership claim for the found item.",
        },
        entityType: "FOUND_REPORT",
        entityId: foundReportId,
        action: "OPEN_FOUND_REPORT",
        dedupeKey: `found-claim-submitted:${claim.id}:${report.finderId}`,
        pushPriority: "high",
      }),
      "claim submitted"
    );
    return claim;
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new AppError(
        "A claim already exists for this found report",
        409,
        true,
        "FOUND_REPORT_CLAIM_ALREADY_EXISTS"
      );
    }
    throw error;
  }
}

export async function getMyFoundReportClaim(
  claimantId: string,
  foundReportId: string
) {
  return prisma.foundReportClaim.findUnique({
    where: { foundReportId_claimantId: { foundReportId, claimantId } },
    select: claimPublicSelect,
  });
}

export async function listFoundReportClaims(
  finderId: string,
  foundReportId: string
) {
  const report = await prisma.foundReport.findUnique({
    where: { id: foundReportId },
  });
  if (!report) throw new AppError("Found report not found", 404);
  if (report.finderId !== finderId) throw new AppError("Forbidden", 403);
  return prisma.foundReportClaim.findMany({
    where: { foundReportId },
    select: {
      ...claimPublicSelect,
      claimant: { select: { displayName: true, photoURL: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function rejectFoundReportClaim(
  finderId: string,
  foundReportId: string,
  claimId: string
) {
  const claim = await prisma.foundReportClaim.findFirst({
    where: { id: claimId, foundReportId },
    include: { foundReport: true },
  });
  if (!claim) throw new AppError("Claim not found", 404);
  if (claim.foundReport.finderId !== finderId)
    throw new AppError("Forbidden", 403);
  if (claim.status !== "PENDING")
    throw new AppError("Claim is no longer pending", 409);
  const rejected = await prisma.foundReportClaim.update({
    where: { id: claim.id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: finderId,
    },
    select: claimPublicSelect,
  });
  safelyNotify(
    notificationService.createNotification({
      receiverId: claim.claimantId,
      category: "IMPORTANT",
      type: "FOUND_REPORT_CLAIM_REJECTED",
      title: {
        vi: "Yêu cầu nhận đồ chưa được chấp nhận",
        en: "Ownership claim rejected",
      },
      content: {
        vi: "Yêu cầu xác nhận quyền sở hữu của bạn chưa được chấp nhận.",
        en: "Your ownership claim was not accepted.",
      },
      entityType: "FOUND_REPORT",
      entityId: foundReportId,
      action: "OPEN_FOUND_REPORT",
      dedupeKey: `found-claim-rejected:${claim.id}:${claim.claimantId}`,
      pushPriority: "high",
    }),
    "claim rejected"
  );
  return rejected;
}

export async function acceptFoundReportClaim(
  finderId: string,
  foundReportId: string,
  claimId: string
) {
  const accepted = await prisma.$transaction(async (tx) => {
    const claim = await tx.foundReportClaim.findFirst({
      where: { id: claimId, foundReportId },
      include: {
        foundReport: { include: { finder: true } },
        claimant: true,
        returnSession: true,
      },
    });
    if (!claim) throw new AppError("Claim not found", 404);
    if (claim.foundReport.finderId !== finderId)
      throw new AppError("Forbidden", 403);
    if (claim.status === "ACCEPTED" && claim.returnSession) return claim;
    if (claim.status !== "PENDING" || claim.foundReport.resolvedAt) {
      throw new AppError("Claim is no longer available", 409);
    }
    const otherAccepted = await tx.foundReportClaim.findFirst({
      where: { foundReportId, status: "ACCEPTED" },
    });
    if (otherAccepted)
      throw new AppError("Another claim was already accepted", 409);

    const sessionId = `ret_${nanoid(18)}`;
    const session = await tx.returnSession.create({
      data: {
        id: sessionId,
        channelId: `return_${sessionId}`,
        foundReportId,
        ownerId: claim.claimantId,
        finderId,
      },
    });
    await tx.foundReportClaim.updateMany({
      where: { foundReportId, id: { not: claim.id }, status: "PENDING" },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: finderId,
      },
    });
    return tx.foundReportClaim.update({
      where: { id: claim.id },
      data: {
        status: "ACCEPTED",
        reviewedAt: new Date(),
        reviewedById: finderId,
        returnSessionId: session.id,
      },
      include: {
        foundReport: { include: { finder: true } },
        claimant: true,
        returnSession: true,
      },
    });
  });

  const session = accepted.returnSession!;
  safelyNotify(
    notificationService.createNotification({
      receiverId: accepted.claimantId,
      category: "IMPORTANT",
      type: "FOUND_REPORT_CLAIM_ACCEPTED",
      title: {
        vi: "Yêu cầu nhận đồ đã được chấp nhận",
        en: "Ownership claim accepted",
      },
      content: {
        vi: "Yêu cầu của bạn đã được chấp nhận. Hãy tiếp tục quy trình trao trả.",
        en: "Your claim was accepted. Continue to the return workflow.",
      },
      entityType: "RETURN_SESSION",
      entityId: session.id,
      action: "OPEN_RETURN_SESSION",
      dedupeKey: `found-claim-accepted:${accepted.id}:${accepted.claimantId}`,
      pushPriority: "high",
    }),
    "claim accepted"
  );
  await Promise.all([
    upsertStreamUser({
      id: accepted.foundReport.finder.id,
      name: accepted.foundReport.finder.displayName,
      email: accepted.foundReport.finder.email,
      image: accepted.foundReport.finder.photoURL || "",
    }),
    upsertStreamUser({
      id: accepted.claimant.id,
      name: accepted.claimant.displayName,
      email: accepted.claimant.email,
      image: accepted.claimant.photoURL || "",
    }),
  ]);
  const channel = await createReturnChannel({
    channelId: session.channelId,
    sourceType: "FOUND_REPORT",
    sourceId: accepted.foundReportId,
    subjectName: accepted.foundReport.name,
    ownerId: accepted.claimantId,
    finderId,
  });
  return {
    claim: { ...accepted, ownershipProof: undefined },
    channel,
    returnSessionId: session.id,
  };
}
