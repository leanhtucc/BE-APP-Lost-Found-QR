import { Resend } from "resend";
import { ENV } from "../config/env";
import { TemplateUtil } from "../utils/template";
import { logger } from "./logger";

/**
 * Email Service
 * Gửi email thông qua Resend API
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
      logger.warn("Resend not initialized. Skipping email send.");
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
        from: ENV.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        logger.error("Failed to send email:", error);
        return false;
      }

      logger.info(`Email sent successfully to ${options.to}: ${data?.id}`);
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
    const subject = "🔐 Xác thực tài khoản của bạn - Lost & Found";

    // Load and render template with variables
    const html = TemplateUtil.loadAndRender(
      "verification",
      {
        displayName,
        code,
        year: new Date().getFullYear(),
      },
      {
        useBase64Images: false,
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
    const subject = "🎉 Chào mừng bạn đến với Lost & Found!";

    // Load and render template with variables
    const html = TemplateUtil.loadAndRender(
      "welcome",
      {
        displayName,
        year: new Date().getFullYear(),
      },
      {
        useBase64Images: false,
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
    const subject = "🔑 Đặt lại mật khẩu - Lost & Found";

    // Create reset link (Frontend will handle this URL)
    const resetLink = `${ENV.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                  <!-- Header với gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center;">
                      <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                        <span style="font-size: 40px;">🔑</span>
                      </div>
                      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Đặt lại mật khẩu</h1>
                      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">Bảo mật tài khoản của bạn</p>
                    </td>
                  </tr>

                  <!-- Nội dung -->
                  <tr>
                    <td style="padding: 40px 35px;">
                      <p style="font-size: 16px; color: #374151; margin: 0 0 20px; line-height: 1.6;">
                        Xin chào <strong style="color: #7c3aed;">${displayName}</strong>,
                      </p>

                      <p style="font-size: 15px; color: #6b7280; margin: 0 0 25px; line-height: 1.6;">
                        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào nút bên dưới để tiếp tục:
                      </p>

                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 15px; box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.5); transition: all 0.3s ease;">
                          ✨ Đặt lại mật khẩu
                        </a>
                      </div>

                      <!-- Link backup -->
                      <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin: 25px 0;">
                        <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px;">Hoặc sao chép link này:</p>
                        <p style="font-size: 11px; color: #6366f1; margin: 0; word-break: break-all; font-family: monospace;">${resetLink}</p>
                      </div>

                      <!-- Lưu ý -->
                      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 16px; border-left: 4px solid #f59e0b;">
                        <p style="font-size: 13px; color: #92400e; margin: 0; font-weight: 600;">⚠️ Lưu ý quan trọng:</p>
                        <ul style="margin: 10px 0 0; padding-left: 20px; color: #92400e; font-size: 12px; line-height: 1.8;">
                          <li>Link có hiệu lực trong <strong>30 phút</strong></li>
                          <li>Chỉ sử dụng được <strong>1 lần</strong></li>
                          <li>Nếu không phải bạn yêu cầu, vui lòng bỏ qua email này</li>
                        </ul>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background: #f9fafb; padding: 25px 35px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 5px; font-size: 13px; color: #6b7280;">Trân trọng,</p>
                      <p style="margin: 0; font-size: 14px; color: #7c3aed; font-weight: 600;">Lost & Found Team 💜</p>
                      <p style="margin: 15px 0 0; font-size: 11px; color: #9ca3af;">© ${new Date().getFullYear()} Lost & Found. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
