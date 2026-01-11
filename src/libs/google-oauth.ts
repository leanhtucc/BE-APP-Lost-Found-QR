import { OAuth2Client } from "google-auth-library";
import { ENV } from "../config/env";

/**
 * Google OAuth Client
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
   * Generate Google OAuth URL
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
   * Verify Google OAuth token and get user info
   */
  async verifyToken(code: string): Promise<GoogleUser> {
    try {
      // Exchange code for tokens
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      // Get user info
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
        name: payload.name!,
        given_name: payload.given_name!,
        family_name: payload.family_name!,
        picture: payload.picture!,
      };
    } catch (error) {
      throw new Error(`Google OAuth verification failed: ${error}`);
    }
  }
}

export const googleOAuthService = new GoogleOAuthService();
