import { logger } from "./logger";

export class SmsService {
  /**
   * Send OTP via SMS
   * Chỗ này sẽ tích hợp API của nhà mạng (SpeedSMS, Twilio, eSMS, v.v...)
   */
  async sendOTP(phoneNumber: string, code: string): Promise<boolean> {
    try {
      logger.info(`📱 [SMS SERVICE] Vừa gửi mã OTP [${code}] đến SĐT: ${phoneNumber}`);
      
      // TODO: Thêm logic gọi API SMS provider của bạn ở đây.
      // fetch('https://api.speedsms.vn/index.php/sms/send', { ... })
      
      return true;
    } catch (error) {
      logger.error(`❌ [SMS SERVICE] Lỗi khi gửi SMS tới ${phoneNumber}:`, error);
      return false;
    }
  }
}

export const smsService = new SmsService();
