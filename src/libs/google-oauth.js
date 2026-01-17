"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleOAuthService = exports.GoogleOAuthService = void 0;
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("../config/env");
/**
 * Google OAuth Client
 */
const client = new google_auth_library_1.OAuth2Client(env_1.ENV.GOOGLE_CLIENT_ID, env_1.ENV.GOOGLE_CLIENT_SECRET, env_1.ENV.GOOGLE_CALLBACK_URL);
class GoogleOAuthService {
    /**
     * Generate Google OAuth URL
     */
    getAuthUrl() {
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
    async verifyToken(code) {
        try {
            // Exchange code for tokens
            const { tokens } = await client.getToken(code);
            client.setCredentials(tokens);
            // Get user info
            const ticket = await client.verifyIdToken({
                idToken: tokens.id_token,
                audience: env_1.ENV.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload) {
                throw new Error("Failed to get user payload");
            }
            return {
                id: payload.sub,
                email: payload.email,
                verified_email: payload.email_verified,
                name: payload.name,
                given_name: payload.given_name,
                family_name: payload.family_name,
                picture: payload.picture,
            };
        }
        catch (error) {
            throw new Error(`Google OAuth verification failed: ${error}`);
        }
    }
}
exports.GoogleOAuthService = GoogleOAuthService;
exports.googleOAuthService = new GoogleOAuthService();
//# sourceMappingURL=google-oauth.js.map