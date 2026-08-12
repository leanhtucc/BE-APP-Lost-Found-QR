import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

export function generateToken(payload: {
  id: string;
  uid: string;
  email: string;
}): string {
  return jwt.sign(
    payload,
    ENV.JWT_SECRET as jwt.Secret,
    {
      expiresIn: ENV.JWT_EXPIRES_IN,
    } as jwt.SignOptions
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, ENV.JWT_SECRET);
}
