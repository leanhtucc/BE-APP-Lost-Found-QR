import nodemailer from "nodemailer";
import { ENV } from "../config/env";
import { logger } from "./logger";
import { TemplateUtil } from "../utils/template";

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

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      // Kiểm tra nếu có cấu hình email
      if (!ENV.SMTP_HOST || !ENV.SMTP_PORT) {
        logger.warn("SMTP not configured. Email sending will be disabled.");
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: ENV.SMTP_HOST,
        port: ENV.SMTP_PORT,
        secure: ENV.SMTP_SECURE, // true for 465, false for other ports
        auth: {
          user: ENV.SMTP_USER,
          pass: ENV.SMTP_PASS,
        },
      });

      logger.info("Email service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize email service:", error);
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.warn("Email transporter not initialized. Skipping email send.");
      // Log email content cho development
      logger.info("Email would be sent:", {
        to: options.to,
        subject: options.subject,
        preview: options.text || options.html.substring(0, 100),
      });
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error("Failed to send email:", error);
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    displayName: string,
    code: string
  ): Promise<boolean> {
    const subject = "Xác thực tài khoản - Lost & Found";
    
    // Load and render template with variables
    const html = TemplateUtil.loadAndRender("verification", {
      displayName,
      code,
      year: new Date().getFullYear(),
    }, {
      useBase64Images: true // Embed logo as base64 trong email
    });

    const text = `
      Xin chào ${displayName},
      
      Cảm ơn bạn đã đăng ký tài khoản Lost & Found!
      
      Mã xác thực của bạn là: ${code}
      
      Mã này có hiệu lực trong 15 phút.
      
      Nếu bạn không yêu cầu đăng ký, vui lòng bỏ qua email này.
      
      Trân trọng,
      Lost & Found Team
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async sendWelcomeEmail(email: string, displayName: string): Promise<boolean> {
    const subject = "Chào mừng đến với Lost & Found! 🎉";
    
    // Load and render template with variables
    const html = TemplateUtil.loadAndRender("welcome", {
      displayName,
      year: new Date().getFullYear(),
    }, {
      useBase64Images: true // Embed logo as base64 trong email
    });

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }
}

export const emailService = new EmailService();
