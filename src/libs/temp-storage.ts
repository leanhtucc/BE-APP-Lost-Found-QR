/**
 * Temporary Storage for Pending Registrations
 * Store registration data before email verification
 */

interface PendingRegistration {
  email: string;
  password: string; // hashed
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  verificationCode: string;
  expiresAt: Date;
  createdAt: Date;
}

class TempStorage {
  private storage = new Map<string, PendingRegistration>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Auto cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Save pending registration
   */
  set(email: string, data: Omit<PendingRegistration, "createdAt">): void {
    this.storage.set(email.toLowerCase(), {
      ...data,
      createdAt: new Date(),
    });
  }

  /**
   * Get pending registration
   */
  get(email: string): PendingRegistration | null {
    const data = this.storage.get(email.toLowerCase());
    if (!data) return null;

    // Check if expired
    if (new Date() > data.expiresAt) {
      this.delete(email);
      return null;
    }

    return data;
  }

  /**
   * Delete pending registration
   */
  delete(email: string): void {
    this.storage.delete(email.toLowerCase());
  }

  /**
   * Check if email has pending registration
   */
  has(email: string): boolean {
    return this.storage.has(email.toLowerCase());
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = new Date();
    for (const [email, data] of this.storage.entries()) {
      if (now > data.expiresAt) {
        this.storage.delete(email);
      }
    }
  }

  /**
   * Get storage size
   */
  size(): number {
    return this.storage.size;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const tempStorage = new TempStorage();
