import { NextFunction, Request, Response } from "express";
import { reportService } from "./report.service";

export class ReportController {
  // POST /api/reports/lost-item
  createReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id; // from authMiddleware

      const params = {
        itemId: req.body.item_id,
        location: req.body.location,
        bounty: req.body.bounty,
        paymentMethod: req.body.payment_method,
      };

      const result = await reportService.createLostReport(userId, params);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/reports/webhook/payment
  paymentWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Typically there is a signature validation step here with MoMo/VNPay secrets
      // For MVP, we parse payload directly

      const payload = {
        postId: req.body.post_id,
        amount: req.body.amount,
        provider: req.body.provider,
        transactionCode: req.body.transaction_code,
        status: req.body.status,
      };

      await reportService.handlePaymentWebhook(payload);

      res.json({ success: true, message: "Webhook processed" });
    } catch (err) {
      next(err);
    }
  };
}

export const reportController = new ReportController();
