import * as fs from "fs";
import * as path from "path";
import { AssetUtil } from "./asset";

/**
 * Template utility for loading and rendering HTML email templates
 */
export class TemplateUtil {
  private static templateCache = new Map<string, string>();

  /**
   * Load an email template from the templates/emails directory
   * @param templateName - Name of the template file (without .html extension)
   * @returns Template content as string
   */
  static loadTemplate(templateName: string): string {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    try {
      const templatePath = path.join(
        __dirname,
        "..",
        "templates",
        "emails",
        `${templateName}.html`
      );

      const template = fs.readFileSync(templatePath, "utf-8");
      
      // Cache the template for better performance
      this.templateCache.set(templateName, template);
      
      return template;
    } catch (error) {
      throw new Error(`Failed to load email template: ${templateName}`);
    }
  }

  /**
   * Render a template with variables
   * @param template - Template content with {{variable}} placeholders
   * @param variables - Object containing variable values
   * @returns Rendered template
   */
  static render(template: string, variables: Record<string, any>): string {
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
  static loadAndRender(
    templateName: string,
    variables: Record<string, any>,
    options?: {
      useBase64Images?: boolean;
      baseUrl?: string;
    }
  ): string {
    const template = this.loadTemplate(templateName);

    // Add logo URLs to variables if not provided
    if (!variables.logoUrl) {
      if (options?.useBase64Images) {
        // Use base64 for email clients that might block external images
        try {
          variables.logoUrl = AssetUtil.getEmailLogoBase64("default");
        } catch (error) {
          // Fallback to emoji if logo file doesn't exist
          variables.logoUrl = "";
        }
      } else {
        // Use external URL (requires server to be accessible)
        variables.logoUrl = AssetUtil.getEmailLogo("default", options?.baseUrl);
      }
    }

    return this.render(template, variables);
  }

  /**
   * Clear the template cache (useful in development)
   */
  static clearCache(): void {
    this.templateCache.clear();
  }
}
