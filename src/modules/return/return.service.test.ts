import { describe, expect, it } from "vitest";
import { returnService } from "./return.service";
import { AppError } from "../../middlewares/error.middleware";

describe("ReturnService Unit Tests", () => {
  describe("State Machine Transition Guards", () => {
    it("allows valid forward transition CHAT_ACTIVE -> MEETUP_PROPOSED", () => {
      // Accessing private assertValidTransition via reflection for isolated unit test
      expect(() => {
        (returnService as any).assertValidTransition("CHAT_ACTIVE", "MEETUP_PROPOSED");
      }).not.toThrow();
    });

    it("allows valid forward transition MEETUP_ACCEPTED -> TRACKING_ACTIVE", () => {
      expect(() => {
        (returnService as any).assertValidTransition("MEETUP_ACCEPTED", "TRACKING_ACTIVE");
      }).not.toThrow();
    });

    it("allows valid forward transition HANDOVER_PENDING -> HANDOVER_CONFIRMED", () => {
      expect(() => {
        (returnService as any).assertValidTransition("HANDOVER_PENDING", "HANDOVER_CONFIRMED");
      }).not.toThrow();
    });

    it("blocks illegal transition CHAT_ACTIVE -> HANDOVER_CONFIRMED with 409", () => {
      expect(() => {
        (returnService as any).assertValidTransition("CHAT_ACTIVE", "HANDOVER_CONFIRMED");
      }).toThrowError(AppError);

      try {
        (returnService as any).assertValidTransition("CHAT_ACTIVE", "HANDOVER_CONFIRMED");
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("INVALID_RETURN_TRANSITION");
      }
    });

    it("blocks illegal transition TRACKING_ACTIVE -> COMPLETED with 409", () => {
      try {
        (returnService as any).assertValidTransition("TRACKING_ACTIVE", "COMPLETED");
        expect.unreachable("Should have thrown AppError");
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("INVALID_RETURN_TRANSITION");
      }
    });

    it("allows same state (no-op)", () => {
      expect(() => {
        (returnService as any).assertValidTransition("TRACKING_ACTIVE", "TRACKING_ACTIVE");
      }).not.toThrow();
    });
  });

  describe("Participant Role Verification & Anti-Spoofing (P0)", () => {
    const mockSession = {
      ownerId: "user_owner_123",
      finderId: "user_finder_456",
    };

    it("identifies owner correctly", () => {
      const role = (returnService as any).assertParticipant(mockSession, "user_owner_123");
      expect(role).toBe("OWNER");
    });

    it("identifies finder correctly", () => {
      const role = (returnService as any).assertParticipant(mockSession, "user_finder_456");
      expect(role).toBe("FINDER");
    });

    it("rejects non-participant with 403 FORBIDDEN", () => {
      try {
        (returnService as any).assertParticipant(mockSession, "attacker_stranger_999");
        expect.unreachable("Should have thrown AppError");
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("Concurrency Revision Control", () => {
    const mockSession = { serverRevision: 3 };

    it("passes when If-Match matches serverRevision", () => {
      expect(() => {
        (returnService as any).assertRevision(mockSession, 3);
      }).not.toThrow();
    });

    it("passes when If-Match is omitted", () => {
      expect(() => {
        (returnService as any).assertRevision(mockSession, undefined);
      }).not.toThrow();
    });

    it("throws 409 REVISION_CONFLICT when revision is stale", () => {
      try {
        (returnService as any).assertRevision(mockSession, 2);
        expect.unreachable("Should have thrown AppError");
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("REVISION_CONFLICT");
      }
    });
  });

  describe("Cryptographic Handover Code Hashing", () => {
    it("hashes code consistently with salt", () => {
      const hash1 = (returnService as any).hashCode("852963");
      const hash2 = (returnService as any).hashCode("852963");
      const hashOther = (returnService as any).hashCode("123456");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashOther);
      expect(hash1).toHaveLength(64); // SHA-256 hex string
    });
  });
});
