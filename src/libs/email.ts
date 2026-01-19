import { Resend } from "resend";
import { ENV } from "../config/env";
import { TemplateUtil } from "../utils/template";
import { logger } from "./logger";

/**
 * Email Service
 * Gửi email thông qua Resend API (HTTP-based, không bị Render block)
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      // Kiểm tra nếu có Resend API key
      if (!ENV.RESEND_API_KEY) {
        logger.warn(
          "Resend API key not configured. Email sending will be disabled."
        );
        return;
      }

      this.resend = new Resend(ENV.RESEND_API_KEY);
      logger.info("Email service initialized successfully with Resend");
    } catch (error) {
      logger.error("Failed to initialize email service:", error);
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.resend) {
      logger.warn("Resend client not initialized. Skipping email send.");
      // Log email content cho development
      logger.info("Email would be sent:", {
        to: options.to,
        subject: options.subject,
        preview: options.text || options.html.substring(0, 100),
      });
      return false;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${ENV.EMAIL_FROM_NAME} <${ENV.EMAIL_FROM_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        logger.error("Failed to send email via Resend:", error);
        return false;
      }

      logger.info(
        `Email sent successfully to ${options.to}: ${data?.id || "no-id"}`
      );
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
    const html = TemplateUtil.loadAndRender(
      "verification",
      {
        displayName,
        code,
        year: new Date().getFullYear(),
      },
      {
        useBase64Images: false, // Tắt base64 để giảm dung lượng
      }
    );

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
    const html = TemplateUtil.loadAndRender(
      "welcome",
      {
        displayName,
        year: new Date().getFullYear(),
      },
      {
        useBase64Images: false, // Tắt base64 để giảm dung lượng
      }
    );

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    displayName: string,
    resetToken: string
  ): Promise<boolean> {
    const subject = "Đặt lại mật khẩu - Lost & Found";

    // Create reset link (Frontend will handle this URL)
    const resetLink = `${ENV.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Đặt lại mật khẩu</h1>
            </div>
            <div class="content">
              <p>Xin chào <strong>${displayName}</strong>,</p>

              <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>

              <p>Nhấn vào nút bên dưới để đặt lại mật khẩu:</p>

              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Đặt lại mật khẩu</a>
              </div>

              <p>Hoặc sao chép link sau vào trình duyệt:</p>
              <p style="background-color: #eee; padding: 10px; word-break: break-all; font-size: 12px;">
                ${resetLink}
              </p>

              <div class="warning">
                <strong>⚠️ Lưu ý:</strong>
                <ul style="margin: 5px 0;">
                  <li>Link này chỉ có hiệu lực trong <strong>30 phút</strong></li>
                  <li>Chỉ sử dụng được <strong>1 lần</strong></li>
                  <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
                </ul>
              </div>

              <p style="margin-top: 20px;">Trân trọng,<br><strong>Lost & Found Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Lost & Found. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Xin chào ${displayName},

      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.

      Vui lòng truy cập link sau để đặt lại mật khẩu:
      ${resetLink}

      ⚠️ Lưu ý:
      - Link này chỉ có hiệu lực trong 30 phút
      - Chỉ sử dụng được 1 lần
      - Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này

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
}

export const emailService = new EmailService();
