import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

export const GUEST_JWT_ISSUER = "findback-api";
export const GUEST_JWT_AUDIENCE = "findback-guest";

export interface GuestTokenPayload extends jwt.JwtPayload {
  sub: string;
  typ: "guest";
  rsid: string;
  oiat: number;
}

export function durationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error("Invalid duration");
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
}

export function guestMaxAgeSeconds(): number {
  return durationSeconds(ENV.GUEST_JWT_MAX_AGE);
}

export function issueGuestToken(
  guestUserId: string,
  returnSessionId: string,
  originalIssuedAt = Math.floor(Date.now() / 1000)
): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + durationSeconds(ENV.GUEST_JWT_TTL);
  const token = jwt.sign(
    { typ: "guest", rsid: returnSessionId, oiat: originalIssuedAt },
    ENV.GUEST_JWT_SECRET,
    {
      subject: guestUserId,
      audience: GUEST_JWT_AUDIENCE,
      issuer: GUEST_JWT_ISSUER,
      expiresIn: durationSeconds(ENV.GUEST_JWT_TTL),
      noTimestamp: false,
    }
  );
  return { token, expiresAt };
}

export function verifyGuestToken(token: string): GuestTokenPayload {
  const payload = jwt.verify(token, ENV.GUEST_JWT_SECRET, {
    audience: GUEST_JWT_AUDIENCE,
    issuer: GUEST_JWT_ISSUER,
  });
  if (
    typeof payload === "string" ||
    payload.typ !== "guest" ||
    typeof payload.sub !== "string" ||
    typeof payload.rsid !== "string" ||
    typeof payload.oiat !== "number" ||
    typeof payload.iat !== "number" ||
    payload.oiat > payload.iat
  ) {
    throw new jwt.JsonWebTokenError("Invalid guest token claims");
  }
  return payload as GuestTokenPayload;
}
