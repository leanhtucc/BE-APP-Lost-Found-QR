import { describe, expect, it } from "vitest";
import {
  assertReturnAction,
  getReturnCapabilities,
  isActionAllowed,
  isTrackingUnexpired,
} from "./return.policy";
import { AppError } from "../../middlewares/error.middleware";

describe("Phase 4 Backend Automated Tests", () => {
  describe("2. Return Policy & Capability Guards", () => {
    it("allows directions only when meetup is accepted and session is in navigation/arrival/handover state", () => {
      const activeCaps = getReturnCapabilities({
        status: "TRACKING_ACTIVE",
        hasPendingMeetup: false,
        hasAcceptedMeetup: true,
        trackingExpiresAt: new Date(Date.now() + 60000),
      });
      expect(activeCaps.directionsAllowed).toBe(true);

      const proposedCaps = getReturnCapabilities({
        status: "MEETUP_PROPOSED",
        hasPendingMeetup: true,
        hasAcceptedMeetup: false,
      });
      expect(proposedCaps.directionsAllowed).toBe(false);

      const completedCaps = getReturnCapabilities({
        status: "COMPLETED",
        hasPendingMeetup: false,
        hasAcceptedMeetup: true,
      });
      expect(completedCaps.directionsAllowed).toBe(false);
    });

    it("allows live sharing only when tracking is active and unexpired", () => {
      const validCaps = getReturnCapabilities({
        status: "TRACKING_ACTIVE",
        hasPendingMeetup: false,
        hasAcceptedMeetup: true,
        trackingExpiresAt: new Date(Date.now() + 60000),
      });
      expect(validCaps.liveSharingAllowed).toBe(true);

      const expiredCaps = getReturnCapabilities({
        status: "TRACKING_ACTIVE",
        hasPendingMeetup: false,
        hasAcceptedMeetup: true,
        trackingExpiresAt: new Date(Date.now() - 1000),
      });
      expect(expiredCaps.liveSharingAllowed).toBe(false);
    });

    it("guards update location against expired tracking with TRACKING_EXPIRED code", () => {
      const expiredDate = new Date(Date.now() - 5000);
      expect(
        isActionAllowed("UPDATE_LOCATION", "TRACKING_ACTIVE", expiredDate)
      ).toBe(false);

      try {
        assertReturnAction("UPDATE_LOCATION", "TRACKING_ACTIVE", expiredDate);
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("TRACKING_EXPIRED");
      }
    });

    it("guards direct transition to handover confirmation without previous states", () => {
      expect(isActionAllowed("CONFIRM_HANDOVER", "CHAT_ACTIVE")).toBe(false);
      expect(isActionAllowed("CONFIRM_HANDOVER", "MEETUP_PROPOSED")).toBe(
        false
      );
      expect(isActionAllowed("CONFIRM_HANDOVER", "TRACKING_ACTIVE")).toBe(
        false
      );
      expect(isActionAllowed("CONFIRM_HANDOVER", "HANDOVER_PENDING")).toBe(
        true
      );
    });
  });

  describe("3. Cancellation & Cleanup Policy", () => {
    it("allows cancel from eligible pre-handover states", () => {
      expect(isActionAllowed("CANCEL", "MEETUP_ACCEPTED")).toBe(true);
      expect(isActionAllowed("CANCEL", "TRACKING_ACTIVE")).toBe(true);
      expect(isActionAllowed("CANCEL", "ARRIVAL_PENDING")).toBe(true);
      expect(isActionAllowed("CANCEL", "HANDOVER_PENDING")).toBe(true);
    });

    it("forbids cancel after irreversible handover confirmation or completion", () => {
      expect(isActionAllowed("CANCEL", "HANDOVER_CONFIRMED")).toBe(false);
      expect(isActionAllowed("CANCEL", "REWARD_RELEASING")).toBe(false);
      expect(isActionAllowed("CANCEL", "RATING_PENDING")).toBe(false);
      expect(isActionAllowed("CANCEL", "COMPLETED")).toBe(false);
    });

    it("clears capabilities when session is cancelled", () => {
      const cancelledCaps = getReturnCapabilities({
        status: "MEETUP_CANCELLED",
        hasPendingMeetup: false,
        hasAcceptedMeetup: false,
      });
      expect(cancelledCaps.directionsAllowed).toBe(false);
      expect(cancelledCaps.liveSharingAllowed).toBe(false);
      expect(cancelledCaps.handoverAllowed).toBe(false);
      expect(cancelledCaps.canCancel).toBe(false);
    });
  });

  describe("4. Tracking Expiration Check", () => {
    it("returns true only for future valid dates", () => {
      expect(isTrackingUnexpired(new Date(Date.now() + 10000))).toBe(true);
      expect(isTrackingUnexpired(new Date(Date.now() - 10000))).toBe(false);
      expect(isTrackingUnexpired(null)).toBe(false);
      expect(isTrackingUnexpired(undefined)).toBe(false);
      expect(isTrackingUnexpired("invalid-date")).toBe(false);
    });
  });
});
