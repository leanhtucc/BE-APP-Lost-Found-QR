import nodemailer, { type Transporter } from "nodemailer";
import { ENV } from "../config/env";
import { logger } from "./logger";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] || character;
  });
}

function emailLayout(title: string, content: string): string {
  return `<!doctype html>
  <html lang="vi">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
        <tr><td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
            <tr><td style="padding:28px;background:#4f46e5;color:#fff;text-align:center"><h1 style="margin:0;font-size:24px">${title}</h1></td></tr>
            <tr><td style="padding:32px;line-height:1.6">${content}</td></tr>
            <tr><td style="padding:20px 32px;background:#f9fafb;color:#6b7280;text-align:center;font-size:12px">Lost &amp; Found · ${new Date().getFullYear()}</td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
}

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    if (!ENV.SMTP_HOST || !ENV.SMTP_USER || !ENV.SMTP_PASS) {
      logger.warn(
        "SMTP email is disabled. Set SMTP_HOST, SMTP_USER and SMTP_PASS."
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_SECURE,
      requireTLS: !ENV.SMTP_SECURE,
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: {
        rejectUnauthorized: true,
      },
    });

    logger.info(
      `Email service configured with SMTP (${ENV.SMTP_HOST}:${ENV.SMTP_PORT})`
    );
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      logger.info("SMTP connection verified successfully");
      return true;
    } catch (error) {
      logger.error("SMTP connection verification failed", error);
      return false;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.warn(
        `Email to ${options.to} was skipped because SMTP is disabled`
      );
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: ENV.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      logger.info(
        `Email sent successfully to ${options.to}: ${info.messageId}`
      );
      return true;
    } catch (error) {
      logger.error(`Failed to send email to ${options.to}`, error);
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    displayName: string,
    code: string
  ): Promise<boolean> {
    const safeName = escapeHtml(displayName);
    const safeCode = escapeHtml(code);
    const html = emailLayout(
      "Xác thực tài khoản",
      `<p>Xin chào <strong>${safeName}</strong>,</p>
       <p>Mã OTP xác thực tài khoản của bạn là:</p>
       <div style="margin:24px 0;padding:18px;background:#eef2ff;border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#4338ca">${safeCode}</div>
       <p>Mã có hiệu lực trong <strong>15 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
       <p>Nếu bạn không thực hiện đăng ký, hãy bỏ qua email này.</p>`
    );

    return this.sendEmail({
      to: email,
      subject: "Mã OTP xác thực tài khoản Lost & Found",
      html,
      text: `Xin chào ${displayName}. Mã OTP của bạn là ${code}. Mã có hiệu lực trong 15 phút.`,
    });
  }

  async sendWelcomeEmail(email: string, displayName: string): Promise<boolean> {
    const html = emailLayout(
      "Chào mừng đến với Lost & Found",
      `<p>Xin chào <strong>${escapeHtml(displayName)}</strong>,</p>
       <p>Tài khoản của bạn đã được xác thực thành công. Bạn có thể bắt đầu đăng và tìm kiếm đồ thất lạc.</p>`
    );

    return this.sendEmail({
      to: email,
      subject: "Chào mừng bạn đến với Lost & Found",
      html,
      text: `Xin chào ${displayName}. Tài khoản Lost & Found của bạn đã được xác thực thành công.`,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    displayName: string,
    resetToken: string
  ): Promise<boolean> {
    const resetLink = `${ENV.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const html = emailLayout(
      "Đặt lại mật khẩu",
      `<p>Xin chào <strong>${escapeHtml(displayName)}</strong>,</p>
       <p>Bạn vừa yêu cầu đặt lại mật khẩu. Liên kết dưới đây có hiệu lực trong 30 phút:</p>
       <p style="text-align:center;margin:28px 0"><a href="${escapeHtml(resetLink)}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600">Đặt lại mật khẩu</a></p>
       <p style="font-size:12px;word-break:break-all;color:#6b7280">${escapeHtml(resetLink)}</p>
       <p>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p>`
    );

    return this.sendEmail({
      to: email,
      subject: "Đặt lại mật khẩu Lost & Found",
      html,
      text: `Xin chào ${displayName}. Đặt lại mật khẩu tại: ${resetLink}. Liên kết có hiệu lực trong 30 phút.`,
    });
  }

  async sendAccountDeletionOtpEmail(
    email: string,
    displayName: string,
    code: string
  ): Promise<boolean> {
    const html = emailLayout(
      "Xác nhận xóa tài khoản",
      `<p>Xin chào <strong>${escapeHtml(displayName)}</strong>,</p>
       <p>Mã xác nhận yêu cầu xóa tài khoản của bạn là:</p>
       <div style="margin:24px 0;padding:18px;background:#fef2f2;border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#b91c1c">${escapeHtml(code)}</div>
       <p>Mã có hiệu lực trong <strong>10 phút</strong> và chỉ dùng một lần.</p>
       <p>Nếu bạn không yêu cầu thao tác này, hãy đổi mật khẩu ngay.</p>`
    );

    return this.sendEmail({
      to: email,
      subject: "Mã xác nhận xóa tài khoản Lost & Found",
      html,
      text: `Xin chào ${displayName}. Mã xác nhận xóa tài khoản là ${code}. Mã có hiệu lực trong 10 phút.`,
    });
  }

  async sendPasswordChangedEmail(
    email: string,
    displayName: string
  ): Promise<boolean> {
    const html = emailLayout(
      "Mật khẩu đã được thay đổi",
      `<p>Xin chào <strong>${escapeHtml(displayName)}</strong>,</p>
       <p>Mật khẩu tài khoản của bạn vừa được thay đổi. Tất cả phiên đăng nhập cũ đã bị thu hồi.</p>
       <p>Nếu bạn không thực hiện thao tác này, hãy liên hệ hỗ trợ ngay.</p>`
    );

    return this.sendEmail({
      to: email,
      subject: "Cảnh báo bảo mật Lost & Found",
      html,
      text: `Xin chào ${displayName}. Mật khẩu tài khoản của bạn vừa được thay đổi và các phiên cũ đã bị thu hồi.`,
    });
  }
}

export const emailService = new EmailService();
