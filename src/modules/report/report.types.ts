export interface ReportLostItemParams {
  itemId: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  bounty: number;
  paymentMethod: string;
}

export interface ReportLostItemResponse {
  postId: string;
  paymentUrl: string;
  message: string;
}

export interface WebhookPaymentPayload {
  postId: string;
  amount: number;
  provider: string; // VNPAY, MOMO
  transactionCode: string; // the mock code from gateway
  status: string; // success / fail
}

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
