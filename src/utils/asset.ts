import * as fs from "fs";
import * as path from "path";
import { ENV } from "../config/env";

/**
 * Asset utility for handling static assets (images, logos, etc.)
 */
export class AssetUtil {
  private static readonly PUBLIC_DIR = path.join(process.cwd(), "public");
  private static readonly ASSETS_DIR = path.join(
    AssetUtil.PUBLIC_DIR,
    "assets"
  );

  /**
   * Get the URL for a public asset
   * @param assetPath - Relative path from /public/assets/ (e.g., "images/logo.png")
   * @param baseUrl - Base URL of your application (e.g., "http://localhost:3000")
   * @returns Full URL to the asset
   */
  static getAssetUrl(assetPath: string, baseUrl?: string): string {
    const base = baseUrl || ENV.APP_URL;
    return `${base}/public/assets/${assetPath}`;
  }

  /**
   * Convert image to base64 data URI for embedding in emails
   * @param imagePath - Relative path from /public/assets/ (e.g., "images/logo.png")
   * @returns Base64 data URI string
   */
  static imageToBase64(imagePath: string): string {
    try {
      const fullPath = path.join(AssetUtil.ASSETS_DIR, imagePath);
      const imageBuffer = fs.readFileSync(fullPath);
      const base64 = imageBuffer.toString("base64");
      const ext = path.extname(imagePath).toLowerCase().slice(1);

      // Determine MIME type
      const mimeTypes: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
      };

      const mimeType = mimeTypes[ext] || "image/png";
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      throw new Error(`Failed to convert image to base64: ${imagePath}`);
    }
  }

  /**
   * Check if an asset exists
   * @param assetPath - Relative path from /public/assets/
   * @returns Boolean indicating if asset exists
   */
  static exists(assetPath: string): boolean {
    const fullPath = path.join(AssetUtil.ASSETS_DIR, assetPath);
    return fs.existsSync(fullPath);
  }

  /**
   * Get absolute path to an asset
   * @param assetPath - Relative path from /public/assets/
   * @returns Absolute file system path
   */
  static getAbsolutePath(assetPath: string): string {
    return path.join(AssetUtil.ASSETS_DIR, assetPath);
  }

  /**
   * Get logo URL for email templates
   * @param variant - Logo variant (default, light, dark)
   * @param baseUrl - Base URL of your application
   * @returns URL to logo
   */
  static getEmailLogo(
    variant: "default" | "light" | "dark" = "default",
    baseUrl?: string
  ): string {
    const logoMap = {
      default: "images/email/logo-email.png",
      light: "images/email/logo-light.png",
      dark: "images/email/logo-dark.png",
    };

    return AssetUtil.getAssetUrl(logoMap[variant], baseUrl);
  }

  /**
   * Get logo as base64 for email embedding (no external requests needed)
   * @param variant - Logo variant
   * @returns Base64 data URI
   */
  static getEmailLogoBase64(
    variant: "default" | "light" | "dark" = "default"
  ): string {
    const logoMap = {
      default: "images/email/logo-email.png",
      light: "images/email/logo-light.png",
      dark: "images/email/logo-dark.png",
    };

    return AssetUtil.imageToBase64(logoMap[variant]);
  }
}
