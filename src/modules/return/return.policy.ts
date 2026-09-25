import { AppError } from "../../middlewares/error.middleware";
import { ReturnCapabilities, ReturnSessionStatus } from "./return.types";

export type ReturnAction =
  | "PROPOSE_MEETUP"
  | "ACCEPT_MEETUP"
  | "REJECT_MEETUP"
  | "START_TRACKING"
  | "UPDATE_LOCATION"
  | "ARRIVE"
  | "INIT_HANDOVER"
  | "CONFIRM_HANDOVER"
  | "DISPUTE"
  | "CANCEL"
  | "RATE";

const ACTION_STATES: Record<ReturnAction, readonly ReturnSessionStatus[]> = {
  PROPOSE_MEETUP: ["CHAT_ACTIVE", "MEETUP_CANCELLED", "TRACKING_EXPIRED"],
  ACCEPT_MEETUP: ["MEETUP_PROPOSED"],
  REJECT_MEETUP: ["MEETUP_PROPOSED"],
  START_TRACKING: ["MEETUP_ACCEPTED", "TRACKING_ACTIVE", "ARRIVAL_PENDING"],
  UPDATE_LOCATION: ["TRACKING_ACTIVE", "ARRIVAL_PENDING"],
  ARRIVE: ["TRACKING_ACTIVE", "ARRIVAL_PENDING"],
  INIT_HANDOVER: ["HANDOVER_PENDING"],
  CONFIRM_HANDOVER: ["HANDOVER_PENDING"],
  DISPUTE: [
    "CHAT_ACTIVE",
    "MEETUP_PROPOSED",
    "MEETUP_ACCEPTED",
    "TRACKING_ACTIVE",
    "ARRIVAL_PENDING",
    "HANDOVER_PENDING",
    "HANDOVER_CONFIRMED",
    "REWARD_RELEASING",
    "PAYOUT_FAILED",
  ],
  CANCEL: [
    "MEETUP_ACCEPTED",
    "TRACKING_ACTIVE",
    "ARRIVAL_PENDING",
    "HANDOVER_PENDING",
  ],
  RATE: ["RATING_PENDING"],
};

export function isTrackingUnexpired(
  expiresAt: Date | string | null | undefined
): boolean {
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export function isActionAllowed(
  action: ReturnAction,
  status: ReturnSessionStatus,
  trackingExpiresAt?: Date | string | null
): boolean {
  if (!ACTION_STATES[action].includes(status)) return false;
  if (action === "UPDATE_LOCATION" || action === "ARRIVE") {
    return isTrackingUnexpired(trackingExpiresAt);
  }
  return true;
}

export function assertReturnAction(
  action: ReturnAction,
  status: ReturnSessionStatus,
  trackingExpiresAt?: Date | string | null
): void {
  if (isActionAllowed(action, status, trackingExpiresAt)) return;
  throw new AppError(
    `Action ${action} is not allowed while return session is ${status}`,
    409,
    true,
    action === "UPDATE_LOCATION" && !isTrackingUnexpired(trackingExpiresAt)
      ? "TRACKING_EXPIRED"
      : "INVALID_RETURN_TRANSITION"
  );
}

export function getReturnCapabilities(input: {
  status: ReturnSessionStatus;
  hasPendingMeetup: boolean;
  hasAcceptedMeetup: boolean;
  trackingExpiresAt?: Date | string | null;
  hasHandoverConfirmation?: boolean;
}): ReturnCapabilities {
  const { status, hasPendingMeetup, hasAcceptedMeetup, trackingExpiresAt } =
    input;
  const directionsStates: ReturnSessionStatus[] = [
    "MEETUP_ACCEPTED",
    "TRACKING_ACTIVE",
    "ARRIVAL_PENDING",
    "HANDOVER_PENDING",
  ];

  return {
    canReviewMeetup: status === "MEETUP_PROPOSED" && hasPendingMeetup,
    directionsAllowed: hasAcceptedMeetup && directionsStates.includes(status),
    liveSharingAllowed:
      hasAcceptedMeetup &&
      isActionAllowed("UPDATE_LOCATION", status, trackingExpiresAt),
    handoverAllowed: status === "HANDOVER_PENDING" && hasAcceptedMeetup,
    canCancel:
      !input.hasHandoverConfirmation &&
      isActionAllowed("CANCEL", status, trackingExpiresAt),
  };
}

export const RETURN_TERMINAL_OR_PRIVATE_REVOKED_STATES: readonly ReturnSessionStatus[] =
  [
    "HANDOVER_CONFIRMED",
    "REWARD_RELEASING",
    "REWARD_PAID",
    "RATING_PENDING",
    "COMPLETED",
    "MEETUP_CANCELLED",
    "TRACKING_EXPIRED",
    "HANDOVER_DISPUTED",
    "PAYOUT_FAILED",
    "REFUND_PENDING",
  ];
