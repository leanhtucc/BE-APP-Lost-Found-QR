import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

/**
 * JWT Utility Library
 */

export interface TokenPayload {
  id: string;
  uid: string;
  email: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    payload,
    ENV.JWT_SECRET as jwt.Secret,
    {
      expiresIn: ENV.JWT_EXPIRES_IN,
    } as jwt.SignOptions
  );
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(
    payload,
    ENV.JWT_REFRESH_SECRET as jwt.Secret,
    {
      expiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as TokenPayload;
}

export function decodeToken(token: string) {
  return jwt.decode(token);
}
