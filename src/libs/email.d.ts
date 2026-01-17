/**
 * Email Service
 * Gửi email thông qua SMTP
 */
interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
declare class EmailService {
    private transporter;
    constructor();
    private initialize;
    sendEmail(options: SendEmailOptions): Promise<boolean>;
    sendVerificationEmail(email: string, displayName: string, code: string): Promise<boolean>;
    sendWelcomeEmail(email: string, displayName: string): Promise<boolean>;
    sendPasswordResetEmail(email: string, displayName: string, resetToken: string): Promise<boolean>;
}
export declare const emailService: EmailService;
export {};
//# sourceMappingURL=email.d.ts.map