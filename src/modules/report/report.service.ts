import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { ENV } from "../../config/env";
import { logger } from "../../libs/logger";
import { prisma } from "../../libs/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { emitLostItemToNearbyUsers } from "../../socket/radar.socket";
import { encodeGeoHash } from "../../utils/geospatial";
import {
  CancelTransactionResult,
  CompleteTransactionResult,
  PaymentSession,
  ReportLostItemParams,
  ReportLostItemResponse,
  ReportStatusResponse,
  WebhookPaymentPayload,
} from "./report.types";

const SYSTEM_FEE_PERCENTAGE = 0.1;
const PAYMENT_SESSION_MS = 15 * 60 * 1000;
const REPORT_PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const EARTH_RADIUS_METERS = 6_371_000;

function guardianError(message: string, statusCode: number, code: string): AppError {
  return new AppError(message, statusCode, true, code);
}

function normalizeAddress(address?: string): string | null {
  if (!address) return null;
  return address.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
}

function vnPayDate(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}`;
}

function canonicalSignaturePayload(values: Record<string, unknown>): string {
  return Object.entries(values)
    .filter(([key, value]) => value !== undefined && value !== null && key !== "signature" && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType")
    .filter(([key]) => key.startsWith("vnp_") || !Object.keys(values).some((candidate) => candidate.startsWith("vnp_")))
    .sort(([a], [b]) => a.localeCompare(b))
    // VNPay's official SDK signs the sorted query string with spaces encoded
    // as '+', not '%20'. Use the same representation in the URL and HMAC.
    .map(([key, value]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value)).replace(/%20/g, "+")}`
    )
    .join("&");
}

export class ReportService {
  async countNearbyActiveUsers(lat: number, lng: number, radiusMeters: number): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count
       FROM "UserLocation" ul
       WHERE ul."updatedAt" >= NOW() - INTERVAL '1 hour'
         AND ${EARTH_RADIUS_METERS} * acos(LEAST(1.0,
           cos(radians($1)) * cos(radians(ul."lat")) *
           cos(radians(ul."lng") - radians($2)) + sin(radians($1)) * sin(radians(ul."lat"))
         )) <= $3`,
      lat,
      lng,
      radiusMeters
    );
    return Number(rows[0]?.count ?? 0);
  }

  private assertPaymentConfiguration(): void {
    if (!ENV.VNPAY_TMN_CODE || !ENV.VNPAY_HASH_SECRET) {
      throw guardianError("Payment gateway is not configured", 503, "PAYMENT_GATEWAY_NOT_CONFIGURED");
    }
  }

  private buildPaymentUrl(input: {
    providerOrderId: string;
    amount: number;
    requestIp: string;
    expiresAt: Date;
  }): string {
    this.assertPaymentConfiguration();
    const now = new Date();
    const values: Record<string, string> = {
      vnp_Amount: String(input.amount * 100),
      vnp_Command: "pay",
      vnp_CreateDate: vnPayDate(now),
      vnp_CurrCode: "VND",
      vnp_ExpireDate: vnPayDate(input.expiresAt),
      vnp_IpAddr: input.requestIp || "127.0.0.1",
      vnp_Locale: "vn",
      vnp_OrderInfo: `Guardian payment ${input.providerOrderId}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: ENV.VNPAY_RETURN_URL,
      vnp_TmnCode: ENV.VNPAY_TMN_CODE,
      vnp_TxnRef: input.providerOrderId,
      vnp_Version: "2.1.0",
    };
    const signedQuery = canonicalSignaturePayload(values);
    const signature = createHmac("sha512", ENV.VNPAY_HASH_SECRET)
      .update(signedQuery, "utf8")
      .digest("hex");
    const joiner = ENV.VNPAY_PAYMENT_URL.includes("?") ? "&" : "?";
    return `${ENV.VNPAY_PAYMENT_URL}${joiner}${signedQuery}&vnp_SecureHash=${signature}`;
  }

  private toPaymentSession(post: any, payment: any): PaymentSession {
    return {
      payment_id: payment.id,
      payment_url: payment.paymentUrl,
      base_reward: post.bountyAmount,
      service_fee: post.serviceFee,
      total_to_pay: payment.amount,
      currency: "VND",
      expires_at: payment.expiresAt.toISOString(),
    };
  }

  private async lockItem(tx: any, itemId: string): Promise<void> {
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "Item" WHERE "id" = $1 OR "itemId" = $1 OR "qr_code_id" = $1 FOR UPDATE',
      itemId
    );
  }

  async createLostReport(userId: string, params: ReportLostItemParams): Promise<ReportLostItemResponse> {
    this.assertPaymentConfiguration();
    const rawKey = params.idempotencyKey?.trim();
    const idempotencyKey = rawKey || randomUUID();

    const result = await prisma.$transaction(async (tx: any) => {
      const retry = await tx.post.findUnique({
        where: { idempotencyKey },
        include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (retry) {
        if (retry.ownerId !== userId || retry.status !== "PENDING_PAYMENT" || !retry.payments[0]) {
          throw guardianError("The idempotency key cannot be reused for this request", 409, "IDEMPOTENCY_KEY_REUSED");
        }
        return { post: retry, payment: retry.payments[0] };
      }

      await this.lockItem(tx, params.itemId);
      // A concurrent request with the same key may have committed while this
      // transaction waited for the item lock. Re-read it before creating work.
      const concurrentRetry = await tx.post.findUnique({
        where: { idempotencyKey },
        include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (concurrentRetry) {
        if (concurrentRetry.ownerId !== userId || concurrentRetry.status !== "PENDING_PAYMENT" || !concurrentRetry.payments[0]) {
          throw guardianError("The idempotency key cannot be reused for this request", 409, "IDEMPOTENCY_KEY_REUSED");
        }
        return { post: concurrentRetry, payment: concurrentRetry.payments[0] };
      }
      const item = await tx.item.findFirst({
        where: {
          OR: [
            { id: params.itemId },
            { itemId: params.itemId },
            { qrCodeId: params.itemId },
          ],
        },
      });
      if (!item) {
        throw guardianError("Item not found", 404, "ITEM_NOT_FOUND");
      }
      if (item.ownerId !== userId) throw guardianError("You do not own this item", 403, "ITEM_NOT_OWNED");
      if (item.status !== "SAFE") {
        throw guardianError("Item is not eligible for a Guardian report", 409, "ITEM_NOT_ELIGIBLE");
      }

      const owner = await tx.user.findUnique({ where: { id: userId }, select: { isVerified: true } });
      if (!owner?.isVerified && !ENV.SKIP_EMAIL_VERIFICATION) {
        throw guardianError("User must verify their account before creating a report", 403, "USER_NOT_VERIFIED");
      }

      const existing = await tx.post.findFirst({
        where: { itemId: item.id, status: { in: ["PENDING_PAYMENT", "ACTIVE"] } },
        select: { id: true },
      });
      if (existing) throw guardianError(`Item already has an open Guardian report: ${existing.id}`, 409, "REPORT_ALREADY_EXISTS");

      const serviceFee = Math.round(params.reward.baseAmount * SYSTEM_FEE_PERCENTAGE);
      const totalToPay = params.reward.baseAmount + serviceFee;
      const now = new Date();
      const paymentExpiresAt = new Date(now.getTime() + PAYMENT_SESSION_MS);
      const reportExpiresAt = new Date(now.getTime() + REPORT_PAYMENT_WINDOW_MS);
      const providerOrderId = randomUUID();
      const paymentUrl = this.buildPaymentUrl({
        providerOrderId,
        amount: totalToPay,
        requestIp: params.requestIp,
        expiresAt: paymentExpiresAt,
      });
      const post = await tx.post.create({
        data: {
          ownerId: userId,
          itemId: item.id,
          lat: params.location.lat,
          lng: params.location.lng,
          address: params.location.address?.trim(),
          normalizedAddress: normalizeAddress(params.location.address),
          bountyAmount: params.reward.baseAmount,
          totalPaid: totalToPay,
          serviceFee,
          currency: "VND",
          status: "PENDING_PAYMENT",
          radarConfig: { radius: params.radar.radius, duration_hours: params.radar.durationHours },
          radarRadius: params.radar.radius,
          durationHours: params.radar.durationHours,
          expiresAt: reportExpiresAt,
          idempotencyKey,
          description: `Guardian report for ${item.name}`,
        },
      });
      const payment = await tx.payment.create({
        data: {
          reportId: post.id,
          provider: "VNPAY",
          providerOrderId,
          amount: totalToPay,
          currency: "VND",
          paymentUrl,
          expiresAt: paymentExpiresAt,
        },
      });
      return { post, payment };
    });

    return { report_id: result.post.id, status: "PENDING_PAYMENT", payment: this.toPaymentSession(result.post, result.payment) };
  }

  private signatureIsValid(payload: WebhookPaymentPayload): boolean {
    if (!ENV.VNPAY_HASH_SECRET) return false;
    const expected = createHmac("sha512", ENV.VNPAY_HASH_SECRET)
      .update(canonicalSignaturePayload(payload.raw), "utf8")
      .digest("hex");
    const actual = payload.signature.toLowerCase();
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  }

  async handlePaymentWebhook(payload: WebhookPaymentPayload): Promise<void> {
    if (!this.signatureIsValid(payload)) {
      throw guardianError("Invalid payment signature", 400, "INVALID_PAYMENT_SIGNATURE");
    }

    const activatedItem = await prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.findUnique({ where: { providerOrderId: payload.providerOrderId } });
      if (!payment) throw guardianError("Payment not found", 404, "PAYMENT_NOT_FOUND");
      await tx.$queryRawUnsafe('SELECT "id" FROM "Payment" WHERE "id" = $1 FOR UPDATE', payment.id);
      const report = await tx.post.findUnique({ where: { id: payment.reportId } });
      if (!report) throw guardianError("Report not found", 404, "REPORT_NOT_FOUND");
      await tx.$queryRawUnsafe('SELECT "id" FROM "Post" WHERE "id" = $1 FOR UPDATE', report.id);

      if (payment.status === "PAID" && report.status === "ACTIVE") return null;
      if (payment.expiresAt <= new Date()) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "EXPIRED", rawCallback: payload.raw } });
        throw guardianError("Payment session has expired", 409, "PAYMENT_EXPIRED");
      }
      if (payment.amount !== payload.amount || payment.currency !== payload.currency.toUpperCase()) {
        throw guardianError("Payment amount or currency does not match the order", 400, "PAYMENT_AMOUNT_MISMATCH");
      }
      if (report.status !== "PENDING_PAYMENT") {
        throw guardianError("Report cannot accept this payment", 409, "REPORT_NOT_ELIGIBLE");
      }
      if (!payload.paid) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", rawCallback: payload.raw } });
        await tx.post.update({ where: { id: report.id }, data: { status: "PAYMENT_FAILED" } });
        return null;
      }

      const now = new Date();
      const geohash = encodeGeoHash(report.lat, report.lng, 6);
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", providerTransactionId: payload.providerTransactionId, paidAt: now, rawCallback: payload.raw },
      });
      await tx.post.update({
        where: { id: report.id },
        data: { status: "ACTIVE", activatedAt: now, expiresAt: new Date(now.getTime() + (report.durationHours || 24) * 60 * 60 * 1000) },
      });
      const itemTransition = await tx.item.updateMany({
        where: { id: report.itemId, ownerId: report.ownerId, status: "SAFE" },
        data: {
          status: "LOST",
          lostLat: report.lat,
          lostLng: report.lng,
          lostAddress: report.address,
          latitude: report.lat,
          longitude: report.lng,
          locationGeoHash: geohash,
          locationUpdatedAt: now,
        },
      });

      if (itemTransition.count !== 1) {
        throw guardianError(
          "Item is no longer eligible for this Guardian report",
          409,
          "ITEM_NOT_ELIGIBLE"
        );
      }

      await tx.$executeRaw`
        UPDATE "Item"
        SET "location" = ST_SetSRID(
          ST_MakePoint(${report.lng}, ${report.lat}),
          4326
        )::geography
        WHERE "id" = ${report.itemId}
      `;

      return tx.item.findUnique({ where: { id: report.itemId } });
    });

    if (activatedItem) {
      try {
        await emitLostItemToNearbyUsers({
          id: activatedItem.id,
          itemId: activatedItem.id,
          name: activatedItem.name,
          category: activatedItem.category,
          description: activatedItem.description || undefined,
          lostMessage: activatedItem.lostMessage || undefined,
          imagePublicUrl: activatedItem.imagePublicUrl || undefined,
          latitude: activatedItem.lostLat as number,
          longitude: activatedItem.lostLng as number,
          reportedAt: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Guardian report activated but radar broadcast failed", error);
      }
    }
  }

  async getReportStatus(userId: string, reportId: string): Promise<ReportStatusResponse> {
    const report = await prisma.post.findUnique({
      where: { id: reportId },
      include: { item: { select: { status: true } }, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!report) throw guardianError("Report not found", 404, "REPORT_NOT_FOUND");
    if (report.ownerId !== userId) throw guardianError("You do not own this report", 403, "REPORT_NOT_OWNED");
    return {
      report_id: report.id,
      report_status: report.status as ReportStatusResponse["report_status"],
      payment_status: (report.payments[0]?.status as ReportStatusResponse["payment_status"]) ?? null,
      item_status: report.item.status,
      activated_at: report.activatedAt?.toISOString() ?? null,
    };
  }

  async createOrGetPaymentSession(userId: string, reportId: string, requestIp: string): Promise<PaymentSession> {
    this.assertPaymentConfiguration();
    return prisma.$transaction(async (tx: any) => {
      const reportExists = await tx.post.findUnique({ where: { id: reportId }, select: { id: true } });
      if (!reportExists) throw guardianError("Report not found", 404, "REPORT_NOT_FOUND");
      await tx.$queryRawUnsafe('SELECT "id" FROM "Post" WHERE "id" = $1 FOR UPDATE', reportId);
      const report = await tx.post.findUnique({ where: { id: reportId }, include: { payments: { orderBy: { createdAt: "desc" } } } });
      if (!report) throw guardianError("Report not found", 404, "REPORT_NOT_FOUND");
      if (report.ownerId !== userId) throw guardianError("You do not own this report", 403, "REPORT_NOT_OWNED");
      if (report.status !== "PENDING_PAYMENT") throw guardianError("Report is no longer awaiting payment", 409, "REPORT_NOT_ELIGIBLE");
      if (report.expiresAt && report.expiresAt <= new Date()) throw guardianError("Report payment window has expired", 409, "PAYMENT_EXPIRED");

      const current = report.payments.find((payment: any) => payment.status === "PENDING" && payment.expiresAt > new Date());
      if (current) return this.toPaymentSession(report, current);
      await tx.payment.updateMany({ where: { reportId, status: "PENDING" }, data: { status: "EXPIRED" } });

      const expiresAt = new Date(Date.now() + PAYMENT_SESSION_MS);
      const providerOrderId = randomUUID();
      const payment = await tx.payment.create({
        data: {
          reportId,
          provider: "VNPAY",
          providerOrderId,
          amount: report.totalPaid,
          currency: "VND",
          paymentUrl: this.buildPaymentUrl({ providerOrderId, amount: report.totalPaid, requestIp, expiresAt }),
          expiresAt,
        },
      });
      return this.toPaymentSession(report, payment);
    });
  }

  async expirePendingReports(): Promise<number> {
    const due = await prisma.post.findMany({ where: { status: "PENDING_PAYMENT", expiresAt: { lte: new Date() } }, select: { id: true } });
    for (const report of due) {
      await prisma.$transaction(async (tx: any) => {
        await tx.payment.updateMany({ where: { reportId: report.id, status: "PENDING" }, data: { status: "EXPIRED" } });
        await tx.post.updateMany({ where: { id: report.id, status: "PENDING_PAYMENT" }, data: { status: "EXPIRED" } });
      });
    }
    return due.length;
  }

  async cancelEscrowForItem(ownerId: string, itemId: string): Promise<CancelTransactionResult | null> {
    const report = await prisma.post.findFirst({ where: { ownerId, itemId, status: { in: ["PENDING_PAYMENT", "ACTIVE"] } }, orderBy: { createdAt: "desc" }, include: { escrowTransactions: true } });
    if (!report) return null;
    const holding = report.escrowTransactions.find((transaction) => transaction.status === "HOLDING");
    await prisma.$transaction(async (tx: any) => {
      await tx.post.update({ where: { id: report.id }, data: { status: "CANCELLED" } });
      await tx.payment.updateMany({ where: { reportId: report.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      if (holding) await tx.escrowTransaction.update({ where: { id: holding.id }, data: { status: "REFUNDED" } });
    });
    return { postId: report.id, postStatus: "CANCELLED", transactionStatus: holding ? "REFUNDED" : null, refundedAmount: holding?.amount ?? 0 };
  }

  async completeEscrowFromChannel(ownerId: string, channelId: string): Promise<CompleteTransactionResult | null> {
    if (!channelId.startsWith("item_")) return null;
    const [itemId, ...finderParts] = channelId.slice(5).split("_");
    const finderId = finderParts.join("_");
    if (!itemId || !finderId) return null;
    const report = await prisma.post.findFirst({ where: { itemId, ownerId, status: { in: ["ACTIVE", "FOUND", "COMPLETED"] } }, orderBy: { createdAt: "desc" }, include: { escrowTransactions: true } });
    if (!report) return null;
    const holding = report.escrowTransactions.find((transaction) => transaction.status === "HOLDING");
    await prisma.$transaction(async (tx: any) => {
      await tx.post.update({ where: { id: report.id }, data: { status: "COMPLETED" } });
      if (holding) await tx.escrowTransaction.update({ where: { id: holding.id }, data: { status: "RELEASED" } });
      await tx.item.update({ where: { id: itemId }, data: { status: "RESOLVED" } });
    });
    return { postId: report.id, postStatus: "COMPLETED", transactionStatus: holding ? "RELEASED" : null, releasedAmount: report.bountyAmount, finderId };
  }
}

export const reportService = new ReportService();
