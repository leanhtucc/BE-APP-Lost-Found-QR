"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetUtil = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Asset utility for handling static assets (images, logos, etc.)
 */
class AssetUtil {
    static PUBLIC_DIR = path.join(process.cwd(), "public");
    static ASSETS_DIR = path.join(AssetUtil.PUBLIC_DIR, "assets");
    /**
     * Get the URL for a public asset
     * @param assetPath - Relative path from /public/assets/ (e.g., "images/logo.png")
     * @param baseUrl - Base URL of your application (e.g., "http://localhost:3000")
     * @returns Full URL to the asset
     */
    static getAssetUrl(assetPath, baseUrl) {
        const base = baseUrl || process.env.APP_URL || "http://localhost:3000";
        return `${base}/public/assets/${assetPath}`;
    }
    /**
     * Convert image to base64 data URI for embedding in emails
     * @param imagePath - Relative path from /public/assets/ (e.g., "images/logo.png")
     * @returns Base64 data URI string
     */
    static imageToBase64(imagePath) {
        try {
            const fullPath = path.join(AssetUtil.ASSETS_DIR, imagePath);
            const imageBuffer = fs.readFileSync(fullPath);
            const base64 = imageBuffer.toString("base64");
            const ext = path.extname(imagePath).toLowerCase().slice(1);
            // Determine MIME type
            const mimeTypes = {
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                gif: "image/gif",
                svg: "image/svg+xml",
            };
            const mimeType = mimeTypes[ext] || "image/png";
            return `data:${mimeType};base64,${base64}`;
        }
        catch (error) {
            throw new Error(`Failed to convert image to base64: ${imagePath}`);
        }
    }
    /**
     * Check if an asset exists
     * @param assetPath - Relative path from /public/assets/
     * @returns Boolean indicating if asset exists
     */
    static exists(assetPath) {
        const fullPath = path.join(AssetUtil.ASSETS_DIR, assetPath);
        return fs.existsSync(fullPath);
    }
    /**
     * Get absolute path to an asset
     * @param assetPath - Relative path from /public/assets/
     * @returns Absolute file system path
     */
    static getAbsolutePath(assetPath) {
        return path.join(AssetUtil.ASSETS_DIR, assetPath);
    }
    /**
     * Get logo URL for email templates
     * @param variant - Logo variant (default, light, dark)
     * @param baseUrl - Base URL of your application
     * @returns URL to logo
     */
    static getEmailLogo(variant = "default", baseUrl) {
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
    static getEmailLogoBase64(variant = "default") {
        const logoMap = {
            default: "images/email/logo-email.png",
            light: "images/email/logo-light.png",
            dark: "images/email/logo-dark.png",
        };
        return AssetUtil.imageToBase64(logoMap[variant]);
    }
}
exports.AssetUtil = AssetUtil;
//# sourceMappingURL=asset.js.map