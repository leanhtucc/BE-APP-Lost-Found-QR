/**
 * Template utility for loading and rendering HTML email templates
 */
export declare class TemplateUtil {
    private static templateCache;
    /**
     * Load an email template from the templates/emails directory
     * @param templateName - Name of the template file (without .html extension)
     * @returns Template content as string
     */
    static loadTemplate(templateName: string): string;
    /**
     * Render a template with variables
     * @param template - Template content with {{variable}} placeholders
     * @param variables - Object containing variable values
     * @returns Rendered template
     */
    static render(template: string, variables: Record<string, any>): string;
    /**
     * Load and render a template in one step
     * @param templateName - Name of the template file
     * @param variables - Variables to inject into template
     * @param options - Additional options (useBase64Images, baseUrl)
     * @returns Rendered HTML
     */
    static loadAndRender(templateName: string, variables: Record<string, any>, options?: {
        useBase64Images?: boolean;
        baseUrl?: string;
    }): string;
    /**
     * Clear the template cache (useful in development)
     */
    static clearCache(): void;
}
//# sourceMappingURL=template.d.ts.map