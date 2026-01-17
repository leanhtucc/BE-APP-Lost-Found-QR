export interface GoogleUser {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
}
export declare class GoogleOAuthService {
    /**
     * Generate Google OAuth URL
     */
    getAuthUrl(): string;
    /**
     * Verify Google OAuth token and get user info
     */
    verifyToken(code: string): Promise<GoogleUser>;
}
export declare const googleOAuthService: GoogleOAuthService;
//# sourceMappingURL=google-oauth.d.ts.map