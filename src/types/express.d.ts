/**
 * Extend Express Types
 */

declare namespace Express {
  interface Request {
    user?: {
      id: string;
      uid: string;
      email: string;
      displayName?: string;
    };
  }
}
