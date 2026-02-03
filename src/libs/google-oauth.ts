import { OAuth2Client } from "google-auth-library";
import { ENV } from "../config/env";

/**
 * Google OAuth Client
 * Supports both:
 * 1. Web OAuth flow (redirect-based with authorization code)
 * 2. Mobile app flow (direct ID token verification)
 */

const client = new OAuth2Client(
  ENV.GOOGLE_CLIENT_ID,
  ENV.GOOGLE_CLIENT_SECRET,
  ENV.GOOGLE_CALLBACK_URL
);

export interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export class GoogleOAuthService {
  /**
   * Generate Google OAuth URL (for web browser flow)
   */
  getAuthUrl(): string {
    return client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      prompt: "consent",
    });
  }

  /**
   * Verify Google OAuth authorization code (for web browser flow)
   * Exchange authorization code for tokens and verify
   */
  async verifyAuthorizationCode(code: string): Promise<GoogleUser> {
    try {
      // Exchange code for tokens
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      // Get user info from ID token
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: ENV.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error("Failed to get user payload");
      }

      return {
        id: payload.sub,
        email: payload.email!,
        verified_email: payload.email_verified!,
        name:
          payload.name ||
          `${payload.given_name || ""} ${payload.family_name || ""}`.trim() ||
          "User",
        given_name: payload.given_name || "",
        family_name: payload.family_name || "",
        picture: payload.picture || "",
      };
    } catch (error) {
      throw new Error(`Google OAuth verification failed: ${error}`);
    }
  }

  /**
   * Verify Google ID Token directly (for mobile app flow)
   * Mobile apps send ID token directly from Google Sign-In SDK
   */
  async verifyIdToken(idToken: string): Promise<GoogleUser> {
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: ENV.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error("Failed to get user payload from ID token");
      }

      return {
        id: payload.sub,
        email: payload.email!,
        verified_email: payload.email_verified!,
        name:
          payload.name ||
          `${payload.given_name || ""} ${payload.family_name || ""}`.trim() ||
          "User",
        given_name: payload.given_name || "",
        family_name: payload.family_name || "",
        picture: payload.picture || "",
      };
    } catch (error) {
      throw new Error(`Google ID token verification failed: ${error}`);
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use verifyAuthorizationCode instead
   */
  async verifyToken(code: string): Promise<GoogleUser> {
    return this.verifyAuthorizationCode(code);
  }
}

export const googleOAuthService = new GoogleOAuthService();
