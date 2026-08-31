import { NextFunction, Request, Response } from "express";
import { reportService } from "./report.service";

export class ReportController {
  // POST /v1/reports  (also aliased as POST /api/reports/lost-item)
  createReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const idempotencyKey = req.header("Idempotency-Key");
      if (!idempotencyKey) {
        return res.status(400).json({
          success: false,
          error: {
            code: "IDEMPOTENCY_KEY_REQUIRED",
            message: "Idempotency-Key header is required",
          },
        });
      }

      const result = await reportService.createLostReport(userId, {
        itemId: req.body.item_id,
        idempotencyKey,
        requestIp: req.ip || "127.0.0.1",
        location: req.body.location,
        radar: {
          radius: req.body.radar.radius,
          durationHours: req.body.radar.duration_hours,
        },
        reward: {
          baseAmount: req.body.reward.base_amount,
        },
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/reports/webhook/payment
  paymentWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = req.body as Record<string, unknown>;
      const isVnPay = Boolean(raw.vnp_TxnRef);
      const vnpResponseCode = String(raw.vnp_ResponseCode ?? "");
      const vnpTransactionStatus = String(raw.vnp_TransactionStatus ?? "");
      const genericStatus = String(raw.status ?? "").toLowerCase();
      await reportService.handlePaymentWebhook({
        providerOrderId: String(raw.provider_order_id ?? raw.vnp_TxnRef),
        providerTransactionId: String(raw.provider_transaction_id ?? raw.vnp_TransactionNo),
        amount: isVnPay ? Number(raw.vnp_Amount) / 100 : Number(raw.amount),
        currency: String(raw.currency ?? raw.vnp_CurrCode ?? "VND"),
        paid: isVnPay
          ? vnpResponseCode === "00" && (!vnpTransactionStatus || vnpTransactionStatus === "00")
          : genericStatus === "paid" || genericStatus === "success",
        signature: String(raw.signature ?? raw.vnp_SecureHash),
        raw,
      });

      res.json({ success: true, message: "Webhook processed" });
    } catch (err) {
      next(err);
    }
  };

  getReportStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reportService.getReportStatus(req.user!.id, req.params.reportId!);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  paymentSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await reportService.createOrGetPaymentSession(
        req.user!.id,
        req.params.reportId!,
        req.ip || "127.0.0.1"
      );
      res.json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  };
}

export const reportController = new ReportController();
