"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const template_1 = require("../utils/template");
const logger_1 = require("./logger");
class EmailService {
    transporter = null;
    constructor() {
        this.initialize();
    }
    initialize() {
        try {
            // Kiểm tra nếu có cấu hình email
            if (!env_1.ENV.SMTP_HOST || !env_1.ENV.SMTP_PORT) {
                logger_1.logger.warn("SMTP not configured. Email sending will be disabled.");
                return;
            }
            this.transporter = nodemailer_1.default.createTransport({
                host: env_1.ENV.SMTP_HOST,
                port: env_1.ENV.SMTP_PORT,
                secure: env_1.ENV.SMTP_SECURE, // true for 465, false for other ports
                auth: {
                    user: env_1.ENV.SMTP_USER,
                    pass: env_1.ENV.SMTP_PASS,
                },
            });
            logger_1.logger.info("Email service initialized successfully");
        }
        catch (error) {
            logger_1.logger.error("Failed to initialize email service:", error);
        }
    }
    async sendEmail(options) {
        if (!this.transporter) {
            logger_1.logger.warn("Email transporter not initialized. Skipping email send.");
            // Log email content cho development
            logger_1.logger.info("Email would be sent:", {
                to: options.to,
                subject: options.subject,
                preview: options.text || options.html.substring(0, 100),
            });
            return false;
        }
        try {
            const info = await this.transporter.sendMail({
                from: `"${env_1.ENV.SMTP_FROM_NAME}" <${env_1.ENV.SMTP_FROM_EMAIL}>`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });
            logger_1.logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error("Failed to send email:", error);
            return false;
        }
    }
    async sendVerificationEmail(email, displayName, code) {
        const subject = "Xác thực tài khoản - Lost & Found";
        // Load and render template with variables
        const html = template_1.TemplateUtil.loadAndRender("verification", {
            displayName,
            code,
            year: new Date().getFullYear(),
        }, {
            useBase64Images: true, // Embed logo as base64 trong email
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
    async sendWelcomeEmail(email, displayName) {
        const subject = "Chào mừng đến với Lost & Found! 🎉";
        // Load and render template with variables
        const html = template_1.TemplateUtil.loadAndRender("welcome", {
            displayName,
            year: new Date().getFullYear(),
        }, {
            useBase64Images: true, // Embed logo as base64 trong email
        });
        return this.sendEmail({
            to: email,
            subject,
            html,
        });
    }
    async sendPasswordResetEmail(email, displayName, resetToken) {
        const subject = "Đặt lại mật khẩu - Lost & Found";
        // Create reset link (Frontend will handle this URL)
        const resetLink = `${env_1.ENV.FRONTEND_URL}/reset-password?token=${resetToken}`;
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
exports.emailService = new EmailService();
//# sourceMappingURL=email.js.map