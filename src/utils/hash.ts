import bcrypt from "bcrypt";

/**
 * HASH UTILITY
 * - Hash password với bcrypt
 * - So sánh password
 */

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
