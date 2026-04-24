import { NextFunction, Request, Response } from "express";
import { reportService } from "./report.service";

export class ReportController {
  // POST /v1/reports  (also aliased as POST /api/reports/lost-item)
  createReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const result = await reportService.createLostReport(userId, {
        itemId: req.body.item_id,
        location: req.body.location,
        radar: {
          radius: req.body.radar.radius,
          durationHours: req.body.radar.duration_hours,
        },
        reward: {
          baseAmount: req.body.reward.base_amount,
          isCustom: req.body.reward.is_custom,
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
      await reportService.handlePaymentWebhook({
        postId: req.body.post_id,
        amount: req.body.amount,
        provider: req.body.provider,
        transactionCode: req.body.transaction_code,
        status: req.body.status,
      });

      res.json({ success: true, message: "Webhook processed" });
    } catch (err) {
      next(err);
    }
  };
}

export const reportController = new ReportController();
