// ─── Guardian Status ────────────────────────────────────────────────────────
export type GuardianStatus =
  | "PENDING_PAYMENT"
  | "SEARCHING"
  | "FOUND"
  | "EXPIRED_REFUNDED"
  | "CANCELLED"
  | "RESOLVED";

// ─── Create Report (POST /v1/reports) ───────────────────────────────────────
export interface ReportLostItemParams {
  itemId: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  radar: {
    radius: number;      // metres, e.g. 500
    durationHours: number; // e.g. 24
  };
  reward: {
    baseAmount: number;  // e.g. 100000
    isCustom: boolean;
  };
}

export interface ReportLostItemResponse {
  report_id: string;
  status: GuardianStatus;
  payment: {
    total_to_pay: number;  // bounty + 10% platform fee
    payment_url: string;   // Webview URL for VNPay/MoMo
  };
}

// ─── Payment Webhook ────────────────────────────────────────────────────────
export interface WebhookPaymentPayload {
  postId: string;
  amount: number;
  provider: string;         // VNPAY | MOMO
  transactionCode: string;
  status: string;           // success | fail
}

// ─── Cancel / Complete ───────────────────────────────────────────────────────
export interface CancelTransactionResult {
  postId: string;
  postStatus: "CANCELLED";
  transactionStatus: "REFUNDED" | null;
  refundedAmount: number;
}

export interface CompleteTransactionResult {
  postId: string;
  postStatus: "RESOLVED";
  transactionStatus: "RELEASED" | null;
  releasedAmount: number;
  finderId: string;
}
