import { redis } from "./redis";

/**
 * Temporary Storage for Pending Registrations
 * Backed by Redis (with automatic in-memory fallback when REDIS_URL is not set).
 * TTL = 15 minutes — entries expire automatically via Redis key expiry.
 */

export interface PendingRegistration {
  email: string;
  password: string; // hashed
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  verificationCode: string;
  verificationAttempts: number;
  expiresAt: string; // ISO string
  createdAt: string; // ISO string
}

const OTP_TTL_SECONDS = 15 * 60; // 15 minutes
const KEY_PREFIX = "otp:pending:";

class TempStorage {
  private key(identifier: string): string {
    return `${KEY_PREFIX}${identifier.toLowerCase()}`;
  }

  /**
   * Save pending registration with TTL.
   * @param identifier email or phoneNumber used as lookup key
   */
  async set(
    identifier: string,
    data: Omit<PendingRegistration, "createdAt">
  ): Promise<void> {
    const payload: PendingRegistration = {
      ...data,
      expiresAt: data.expiresAt, // already ISO string
      createdAt: new Date().toISOString(),
    };
    // strict: a silent failure here means the OTP email goes out but the code
    // can never be verified.
    await redis.set(this.key(identifier), payload, OTP_TTL_SECONDS, {
      strict: true,
    });
  }

  /**
   * Retrieve pending registration.
   * Returns null when not found or already expired.
   */
  async get(identifier: string): Promise<PendingRegistration | null> {
    const data = await redis.get<PendingRegistration>(this.key(identifier));
    if (!data) return null;

    // Belt-and-suspenders expiry check (Redis TTL is the primary guard)
    if (new Date() > new Date(data.expiresAt)) {
      await this.delete(identifier);
      return null;
    }

    return data;
  }

  /**
   * Delete pending registration.
   */
  async delete(identifier: string): Promise<void> {
    await redis.del(this.key(identifier));
  }

  /**
   * Check whether a pending registration exists.
   */
  async has(identifier: string): Promise<boolean> {
    const data = await this.get(identifier);
    return data !== null;
  }

  /**
   * No-op – kept for interface compatibility.
   * Redis handles cleanup automatically via key TTL.
   */
  destroy(): void {}
}

export const tempStorage = new TempStorage();
