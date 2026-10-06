export type GuardianStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "PAYMENT_FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "FOUND"
  | "COMPLETED";

export interface ReportLostItemParams {
  itemId: string;
  idempotencyKey?: string;
  requestIp: string;
  location: { lat: number; lng: number; address?: string };
  radar: { radius: number; durationHours: number };
  reward: { baseAmount: number };
}

export interface PaymentSession {
  payment_id: string;
  payment_url: string;
  base_reward: number;
  service_fee: number;
  total_to_pay: number;
  currency: "VND";
  expires_at: string;
}

export interface ReportLostItemResponse {
  report_id: string;
  status: "PENDING_PAYMENT";
  payment: PaymentSession;
}

export interface ReportStatusResponse {
  report_id: string;
  report_status: GuardianStatus;
  payment_status:
    "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED" | null;
  item_status: "SAFE" | "LOST" | "FOUND" | "RESOLVED";
  activated_at: string | null;
}

export interface WebhookPaymentPayload {
  providerOrderId: string;
  providerTransactionId: string;
  amount: number;
  currency: string;
  paid: boolean;
  signature: string;
  raw: Record<string, unknown>;
}

export interface CancelTransactionResult {
  postId: string;
  postStatus: "CANCELLED";
  transactionStatus: "REFUNDED" | null;
  refundedAmount: number;
}

export interface CompleteTransactionResult {
  postId: string;
  postStatus: "COMPLETED";
  transactionStatus: "RELEASED" | null;
  releasedAmount: number;
  finderId: string;
}
