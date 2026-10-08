import { describe, expect, it } from "vitest";
import { generateAccessToken, verifyAccessToken } from "./jwt";
import {
  durationSeconds,
  issueGuestToken,
  verifyGuestToken,
} from "./guest-jwt";

describe("scoped guest JWT", () => {
  it("issues claims scoped to one return session and preserves original issue time on refresh", () => {
    const originalIssuedAt = Math.floor(Date.now() / 1000) - 30;
    const first = issueGuestToken("guest-user", "return-a", originalIssuedAt);
    const firstClaims = verifyGuestToken(first.token);
    const refreshed = issueGuestToken(
      firstClaims.sub,
      firstClaims.rsid,
      firstClaims.oiat
    );
    const refreshedClaims = verifyGuestToken(refreshed.token);

    expect(firstClaims).toMatchObject({
      sub: "guest-user",
      typ: "guest",
      rsid: "return-a",
      oiat: originalIssuedAt,
    });
    expect(refreshedClaims.oiat).toBe(originalIssuedAt);
    expect(refreshedClaims.exp).toBeGreaterThan(refreshedClaims.iat!);
  });

  it("cannot be verified by the regular user JWT verifier", () => {
    const guest = issueGuestToken("guest-user", "return-a").token;
    expect(() => verifyAccessToken(guest)).toThrow();
    const user = generateAccessToken({
      id: "user",
      uid: "uid",
      email: "user@example.test",
    });
    expect(() => verifyGuestToken(user)).toThrow();
  });

  it("parses configured duration units", () => {
    expect(durationSeconds("6h")).toBe(21_600);
    expect(durationSeconds("72h")).toBe(259_200);
  });
});
