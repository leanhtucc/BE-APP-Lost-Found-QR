/**
 * Return Flow Types & Contract Interfaces
 * Synchronized with Mobile Client (LostAndFoundQR/types/return-flow.ts)
 */

export type ReturnSessionStatus =
  | "CHAT_ACTIVE"
  | "MEETUP_PROPOSED"
  | "MEETUP_ACCEPTED"
  | "TRACKING_ACTIVE"
  | "ARRIVAL_PENDING"
  | "HANDOVER_PENDING"
  | "HANDOVER_CONFIRMED"
  | "REWARD_RELEASING"
  | "REWARD_PAID"
  | "RATING_PENDING"
  | "COMPLETED"
  | "MEETUP_CANCELLED"
  | "TRACKING_EXPIRED"
  | "HANDOVER_DISPUTED"
  | "PAYOUT_FAILED"
  | "REFUND_PENDING";

export type ReturnUserRole = "OWNER" | "FINDER";

export interface ReturnParticipant {
  id: string; // memberId or userId
  role: ReturnUserRole;
  displayName: string;
  photoURL?: string | null;
  phoneNumber?: string | null;
  isVerified?: boolean;
  trustScore?: number;
  isArrived?: boolean;
  sharingLocation?: boolean;
}

export interface LiveLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  capturedAt: string; // ISO 8601
  ttlSeconds?: number;
}

export interface MeetupProposal {
  id?: string;
  proposedBy: string; // userId of proposer
  proposedByName?: string;
  address: string;
  name?: string;
  latitude: number;
  longitude: number;
  scheduledTime: string; // ISO 8601 or 'ASAP'
  notes?: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  proposedAt: string;
}

export interface HandoverDetails {
  code?: string; // 6-digit verification code
  qrPayload?: string;
  finderConfirmed: boolean;
  ownerConfirmed: boolean;
  finderConfirmedAt?: string;
  ownerConfirmedAt?: string;
  disputeReason?: string;
  disputedBy?: string;
  disputedAt?: string;
}

export interface RewardPayout {
  baseReward: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  payoutMethodMasked?: string; // e.g. "Vietcombank •••• 5678"
  status: "PROCESSING" | "PAID" | "FAILED" | "ACTION_REQUIRED";
  transactionId?: string;
  estimatedArrival?: string;
  paidAt?: string;
  failureReason?: string;
}

export interface FinderRating {
  score: number; // 1 to 5
  tags: string[]; // e.g. ['Thân thiện', 'Đúng giờ', ...]
  comment?: string;
  createdAt: string;
}

export interface ReturnSession {
  id: string; // returnSessionId
  channelId: string;
  itemId: string;
  itemName: string;
  itemCategory?: string;
  itemImageUrl?: string | null;
  rewardAmount?: number;
  status: ReturnSessionStatus;
  owner: ReturnParticipant;
  finder: ReturnParticipant;
  meetup?: MeetupProposal | null;
  handover?: HandoverDetails | null;
  reward?: RewardPayout | null;
  rating?: FinderRating | null;
  createdAt: string;
  updatedAt: string;
  serverRevision: number;
}

export interface ProposeMeetupRequest {
  address: string;
  name?: string;
  latitude: number;
  longitude: number;
  scheduledTime: string;
  notes?: string;
}

export interface ConfirmHandoverRequest {
  code?: string;
  idempotencyKey?: string;
  role?: ReturnUserRole;
}

export interface DisputeHandoverRequest {
  reason: string;
  disputedBy?: string;
}

export interface SubmitRatingRequest {
  score: number;
  tags: string[];
  comment?: string;
}

export interface ReturnApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  requestId?: string;
  timestamp?: string;
}
