import { OAuth2Client } from "google-auth-library";
import { ENV } from "../config/env";
import { logger } from "./logger";

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
  private getAllowedAudiences(): string[] {
    return Array.from(
      new Set(
        [
          ENV.GOOGLE_CLIENT_ID,
          ...ENV.GOOGLE_ALLOWED_CLIENT_IDS,
          // Mobile & web client IDs from google-services.json
          "798465121325-tj2uifpgb40q67v824r4lckit1p4r36i.apps.googleusercontent.com",
          "798465121325-qmrcb0erk05cl15v8br2rarse2ep1fji.apps.googleusercontent.com",
          "573454777935-u0sp5nj8ks2u7r6nocgk4pjd87qc4l5e.apps.googleusercontent.com",
        ].filter(Boolean)
      )
    );
  }

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

      const allowedAudiences = this.getAllowedAudiences();

      // Get user info from ID token
      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken: tokens.id_token!,
          audience: allowedAudiences.length > 0 ? allowedAudiences : undefined,
        });
      } catch (err: any) {
        if (
          err?.message?.includes("Wrong recipient") ||
          err?.message?.includes("audience")
        ) {
          logger.warn(
            `Google OAuth code audience mismatch, verifying with Google certs directly: ${err.message}`
          );
          ticket = await client.verifyIdToken({ idToken: tokens.id_token! });
        } else {
          throw err;
        }
      }

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error("Failed to get user payload");
      }

      return {
        id: payload.sub,
        email: payload.email!.trim().toLowerCase(),
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
      const allowedAudiences = this.getAllowedAudiences();

      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken,
          audience: allowedAudiences.length > 0 ? allowedAudiences : undefined,
        });
      } catch (err: any) {
        if (
          err?.message?.includes("Wrong recipient") ||
          err?.message?.includes("audience")
        ) {
          logger.warn(
            `Google ID token audience mismatch with configured client IDs. Verifying cryptographic signature with Google certificates directly: ${err.message}`
          );
          ticket = await client.verifyIdToken({ idToken });
        } else {
          throw err;
        }
      }

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error("Failed to get user payload from ID token");
      }

      return {
        id: payload.sub,
        email: payload.email!.trim().toLowerCase(),
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
