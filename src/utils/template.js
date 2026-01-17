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
exports.TemplateUtil = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const asset_1 = require("./asset");
/**
 * Template utility for loading and rendering HTML email templates
 */
class TemplateUtil {
    static templateCache = new Map();
    /**
     * Load an email template from the templates/emails directory
     * @param templateName - Name of the template file (without .html extension)
     * @returns Template content as string
     */
    static loadTemplate(templateName) {
        // Check cache first
        if (this.templateCache.has(templateName)) {
            return this.templateCache.get(templateName);
        }
        try {
            const templatePath = path.join(__dirname, "..", "templates", "emails", `${templateName}.html`);
            const template = fs.readFileSync(templatePath, "utf-8");
            // Cache the template for better performance
            this.templateCache.set(templateName, template);
            return template;
        }
        catch (error) {
            throw new Error(`Failed to load email template: ${templateName}`);
        }
    }
    /**
     * Render a template with variables
     * @param template - Template content with {{variable}} placeholders
     * @param variables - Object containing variable values
     * @returns Rendered template
     */
    static render(template, variables) {
        let rendered = template;
        // Replace all {{variable}} placeholders with actual values
        Object.entries(variables).forEach(([key, value]) => {
            const placeholder = new RegExp(`{{${key}}}`, "g");
            rendered = rendered.replace(placeholder, String(value));
        });
        return rendered;
    }
    /**
     * Load and render a template in one step
     * @param templateName - Name of the template file
     * @param variables - Variables to inject into template
     * @param options - Additional options (useBase64Images, baseUrl)
     * @returns Rendered HTML
     */
    static loadAndRender(templateName, variables, options) {
        const template = this.loadTemplate(templateName);
        // Add logo URLs to variables if not provided
        if (!variables.logoUrl) {
            if (options?.useBase64Images) {
                // Use base64 for email clients that might block external images
                try {
                    variables.logoUrl = asset_1.AssetUtil.getEmailLogoBase64("default");
                }
                catch (error) {
                    // Fallback to emoji if logo file doesn't exist
                    variables.logoUrl = "";
                }
            }
            else {
                // Use external URL (requires server to be accessible)
                variables.logoUrl = asset_1.AssetUtil.getEmailLogo("default", options?.baseUrl);
            }
        }
        return this.render(template, variables);
    }
    /**
     * Clear the template cache (useful in development)
     */
    static clearCache() {
        this.templateCache.clear();
    }
}
exports.TemplateUtil = TemplateUtil;
//# sourceMappingURL=template.js.map