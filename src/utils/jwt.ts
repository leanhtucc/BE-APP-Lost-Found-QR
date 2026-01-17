import jwt from "jsonwebtoken";

/**
 * JWT UTILITY
 * - Tạo và verify JWT tokens
 */

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export function generateToken(payload: {
  id: string;
  uid: string;
  email: string;
}): string {
  return jwt.sign(
    payload,
    JWT_SECRET as jwt.Secret,
    {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions
  );
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid token");
  }
}
