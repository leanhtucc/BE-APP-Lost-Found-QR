/**
 * Asset utility for handling static assets (images, logos, etc.)
 */
export declare class AssetUtil {
    private static readonly PUBLIC_DIR;
    private static readonly ASSETS_DIR;
    /**
     * Get the URL for a public asset
     * @param assetPath - Relative path from /public/assets/ (e.g., "images/logo.png")
     * @param baseUrl - Base URL of your application (e.g., "http://localhost:3000")
     * @returns Full URL to the asset
     */
    static getAssetUrl(assetPath: string, baseUrl?: string): string;
    /**
     * Convert image to base64 data URI for embedding in emails
     * @param imagePath - Relative path from /public/assets/ (e.g., "images/logo.png")
     * @returns Base64 data URI string
     */
    static imageToBase64(imagePath: string): string;
    /**
     * Check if an asset exists
     * @param assetPath - Relative path from /public/assets/
     * @returns Boolean indicating if asset exists
     */
    static exists(assetPath: string): boolean;
    /**
     * Get absolute path to an asset
     * @param assetPath - Relative path from /public/assets/
     * @returns Absolute file system path
     */
    static getAbsolutePath(assetPath: string): string;
    /**
     * Get logo URL for email templates
     * @param variant - Logo variant (default, light, dark)
     * @param baseUrl - Base URL of your application
     * @returns URL to logo
     */
    static getEmailLogo(variant?: "default" | "light" | "dark", baseUrl?: string): string;
    /**
     * Get logo as base64 for email embedding (no external requests needed)
     * @param variant - Logo variant
     * @returns Base64 data URI
     */
    static getEmailLogoBase64(variant?: "default" | "light" | "dark"): string;
}
//# sourceMappingURL=asset.d.ts.map