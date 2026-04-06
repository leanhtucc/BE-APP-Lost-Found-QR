import { User } from "@prisma/client";
import { nanoid } from "nanoid";
import { ENV } from "../../config/env";
import { emailService } from "../../libs/email";
import { googleOAuthService } from "../../libs/google-oauth";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../libs/jwt";
import { logger } from "../../libs/logger";
import { createStreamUserToken } from "../../libs/stream-chat";
import admin from "../../config/firebaseAdmin";
import { smsService } from "../../libs/sms";
import { tempStorage } from "../../libs/temp-storage";
import { AppError } from "../../middlewares/error.middleware";
import { comparePassword, hashPassword } from "../../utils/hash";
import { AuthRepository } from "./auth.repository";
import {
  ForgotPasswordDTO,
  ForgotPasswordResponse,
  GoogleAuthResponse,
  LoginDTO,
  LoginResponse,
  PrivacySettings,
  RegisterDTO,
  RegisterResponse,
  ResendOtpDTO,
  ResetPasswordDTO,
  ResetPasswordResponse,
  UpdateProfileDTO,
  UserResponse,
  VerifyOtpDTO,
  VerifyOtpResponse,
} from "./auth.types";

/**
 * Auth Service
 * Business logic for authentication
 */

const authRepository = new AuthRepository();

export class AuthService {
  private formatUserResponse(user: any): UserResponse {
    // Parse privacy settings from JSON
    let privacySettings: PrivacySettings = { showPhone: true, showEmail: true };
    try {
      if (user.privacySettings && typeof user.privacySettings === "object") {
        privacySettings = user.privacySettings as PrivacySettings;
      } else if (typeof user.privacySettings === "string") {
        privacySettings = JSON.parse(user.privacySettings);
      }
    } catch {
      // Use default privacy settings if parse fails
    }

    // Generate stream token for chat functionality
    let streamToken = "";
    try {
      streamToken = createStreamUserToken(user.memberId || user.uid);
    } catch (error) {
      logger.warn("Failed to generate stream token:", error);
    }

    return {
      member_id: user.memberId || `USER_${user.uid}`,
      full_name: user.displayName,
      email: user.email,
      phone: user.phoneNumber || null,
      avatar_url: user.photoURL || null,
      is_verified: user.isVerified || false,
      stats: {
        trust_score: user.trustScore || 5.0,
        items_lost: user.itemsLost || 0,
        items_returned: user.totalReturned || 0,
      },
      address: user.addressCity || null,
      bio: user.bio || null,
      stream_token: streamToken,
      privacy_settings: privacySettings,
      created_at: user.createdAt,
    };
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getCodeExpiry(): Date {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15); // 15 phút
    return expiry;
  }

  async register(data: RegisterDTO): Promise<RegisterResponse> {
    // Check if phone exists
    const existingPhone = await authRepository.findByPhoneNumber(data.phoneNumber);
    if (existingPhone) {
      throw new AppError("Số điện thoại này đã được đăng ký", 400);
    }

    // Check if email exists in database
    const existingUser = await authRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError("Email already registered", 400);
    }

    // Check if phone has pending registration
    if (tempStorage.has(data.phoneNumber)) {
      throw new AppError(
        "Verification code already sent. Please check your SMS or wait to resend.",
        400
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Generate verification code
    const verificationCode = this.generateVerificationCode();
    const expiresAt = this.getCodeExpiry();

    // Save to temporary storage using phoneNumber as Key
    tempStorage.set(data.phoneNumber, {
      email: data.email,
      password: hashedPassword,
      displayName: data.displayName,
      photoURL: data.photoURL,
      phoneNumber: data.phoneNumber,
      verificationCode,
      expiresAt,
    });

    // Giả lập lưu thành công mà không gọi SMS backend vì Mobile tự dùng Firebase SDK để gửi SMS
    return {
      message: "Thông tin đã được lưu tạm. Vui lòng gửi OTP từ Mobile để xác thực.",
      email: data.email,
    };
  }

  async login(data: LoginDTO): Promise<LoginResponse> {
    // Find user by email
    const user = await authRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // Verify password
    if (!user.password) {
      throw new AppError("Invalid email or password", 401);
    }
    const isValidPassword = await comparePassword(data.password, user.password);
    if (!isValidPassword) {
      throw new AppError("Invalid email or password", 401);
    }

    // Check if email is verified
    if (!user.isVerified) {
      throw new AppError(
        "Please verify your email before logging in. Check your inbox for the verification code.",
        403
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Get user
      const user = await authRepository.findById(decoded.id);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
      });

      const newRefreshToken = generateRefreshToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new AppError("Invalid refresh token", 401);
    }
  }

  async getProfile(userId: string): Promise<UserResponse> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    return this.formatUserResponse(user);
  }

  async verifyOtp(data: VerifyOtpDTO): Promise<VerifyOtpResponse> {
    // Check temp storage for pending registration using phoneNumber
    const pendingReg = tempStorage.get(data.phoneNumber);
    if (!pendingReg) {
      throw new AppError(
        "No pending registration found for this phone number. Please register first.",
        404
      );
    }

    // Verify code
    if (pendingReg.verificationCode !== data.code) {
      throw new AppError("Invalid OTP code", 400);
    }

    // Check if code expired
    if (new Date() > pendingReg.expiresAt) {
      tempStorage.delete(data.phoneNumber);
      throw new AppError(
        "OTP expired. Please request a new one.",
        400
      );
    }

    // Create user in database NOW (after verification)
    const uid = `user_${nanoid(16)}`;
    const user = await authRepository.createUser({
      uid,
      email: pendingReg.email,
      password: pendingReg.password,
      displayName: pendingReg.displayName,
      photoURL: pendingReg.photoURL || undefined,
      phoneNumber: pendingReg.phoneNumber || undefined,
      isVerified: true, // Already verified via SMS
      verificationCode: undefined,
      verificationCodeExpiry: undefined,
    });

    // Remove from temp storage
    tempStorage.delete(data.phoneNumber);

    logger.info(
      `User ${user.phoneNumber} created successfully after SMS verification`
    );

    // Send welcome email (optional, since registered successfully)
    try {
      await emailService.sendWelcomeEmail(user.email, user.displayName);
    } catch (error) {
      logger.error("Failed to send welcome email:", error);
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
    });

    return {
      message: "Phone verified successfully! Account created.",
      accessToken,
      refreshToken,
    };
  }

  async resendOtp(
    data: { phoneNumber: string }
  ): Promise<{ message: string }> {
    // Check temp storage
    const pendingReg = tempStorage.get(data.phoneNumber);
    if (!pendingReg) {
      // It's possible the user closed the app and tempStorage expired.
      throw new AppError(
        "No pending registration found. Please register again.",
        404
      );
    }

    // Generate new code
    const verificationCode = this.generateVerificationCode();
    const expiresAt = this.getCodeExpiry();

    // Update temp storage with new code
    tempStorage.set(data.phoneNumber, {
      ...pendingReg,
      verificationCode,
      expiresAt,
    });

    // Send SMS
    const smsSent = await smsService.sendOTP(data.phoneNumber, verificationCode);
    if (!smsSent && !ENV.SKIP_EMAIL_VERIFICATION) {
      throw new AppError("Failed to send SMS OTP", 500);
    }

    return { message: "Mã OTP mới đã được gửi." };
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDTO
  ): Promise<UserResponse> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updated = await authRepository.updateUser(userId, data);
    return this.formatUserResponse(updated);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    await authRepository.deleteUser(userId);
  }

  async getGoogleAuthUrl(): Promise<string> {
    return googleOAuthService.getAuthUrl();
  }

  async googleAuth(code: string): Promise<GoogleAuthResponse> {
    try {
      // Verify Google authorization code and get user info
      const googleUser = await googleOAuthService.verifyToken(code);
      return this.processGoogleUser(googleUser);
    } catch (error) {
      logger.error("Google OAuth error:", error);
      throw new AppError("Google authentication failed", 500);
    }
  }

  /**
   * Google Auth with ID Token (for mobile apps)
   * Mobile apps use Google Sign-In SDK and send ID token directly
   */
  async googleAuthWithIdToken(idToken: string): Promise<GoogleAuthResponse> {
    try {
      // Verify Google ID token directly
      const googleUser = await googleOAuthService.verifyIdToken(idToken);
      return this.processGoogleUser(googleUser);
    } catch (error) {
      logger.error("Google ID token auth error:", error);
      throw new AppError("Google authentication failed", 500);
    }
  }

  /**
   * Firebase Auth with ID Token (for mobile apps)
   */
  async verifyFirebaseToken(idToken: string): Promise<GoogleAuthResponse> {
    try {
      // Import động để tránh lỗi nếu firebaseAdmin config có trục trặc do thiếu ENV
      const admin: any = (await import("../../config/firebaseAdmin.js")).default;
      
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid, phone_number, email, picture, name } = decodedToken;

      let user = await authRepository.findByUid(uid);
      let isNewUser = false;

      if (!user) {
        let actualEmail = email;
        if (!actualEmail) {
            actualEmail = `${uid}@firebase.app`;
        } else {
            // Check if email already exists
            const existingWithEmail = await authRepository.findByEmail(actualEmail);
            if (existingWithEmail) {
                 actualEmail = `${uid}_${actualEmail}`; // Prevent duplicate email constraint error
            }
        }
        
        const createdUser = await authRepository.createUser({
          uid: uid,
          email: actualEmail,
          password: "", 
          displayName: name || "Người dùng mới",
          photoURL: picture || undefined,
          phoneNumber: phone_number || undefined,
          isVerified: true, 
        });
        
        user = await authRepository.findByUid(createdUser.uid);
        isNewUser = true;
      }

      if (!user) {
        throw new AppError("Failed to create or find user", 500);
      }

      const accessToken = generateAccessToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
      });

      // Provide isNewUser info via GoogleAuthResponse interface compatibility
      return {
        accessToken,
        refreshToken,
        user: this.formatUserResponse(user),
        isNewUser,
      };
    } catch (error: any) {
      logger.error("Firebase Auth error:", error);
      if (error.code && String(error.code).startsWith('auth/')) {
        throw new AppError("Invalid or expired Firebase ID Token", 401);
      }
      throw new AppError("Firebase authentication failed", 500);
    }
  }

  /**
   * Process Google user - shared logic for both web and mobile flows
   */
  private async processGoogleUser(googleUser: {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    picture: string;
  }): Promise<GoogleAuthResponse> {
    if (!googleUser.verified_email) {
      throw new AppError("Google email not verified", 400);
    }

    // Check if user exists with Google ID
    let user: User | null = await authRepository.findByGoogleId(googleUser.id);
    let isNewUser = false;

    if (!user) {
      // Check if user exists with same email
      user = await authRepository.findByEmail(googleUser.email);

      if (user) {
        // Link Google account to existing user
        await authRepository.updateUser(user.id, {
          googleId: googleUser.id,
          photoURL: googleUser.picture || user.photoURL || undefined,
          isVerified: true, // Auto-verify Google users
        });
        user = await authRepository.findByEmail(user.email);
        logger.info(`Google account linked to existing user: ${user!.email}`);
      } else {
        // Create new user with Google account
        const uid = `user_${nanoid(16)}`;
        await authRepository.createUser({
          uid,
          email: googleUser.email,
          password: "", // Empty string for OAuth users
          displayName: googleUser.name,
          photoURL: googleUser.picture || undefined,
          isVerified: true, // Auto-verify Google users
          googleId: googleUser.id,
          verificationCode: undefined,
          verificationCodeExpiry: undefined,
        });
        user = await authRepository.findByEmail(googleUser.email);
        isNewUser = true;
        logger.info(`New user created via Google OAuth: ${user!.email}`);

        // Send welcome email for new users
        try {
          await emailService.sendWelcomeEmail(user!.email, user!.displayName);
        } catch (error) {
          logger.error("Failed to send welcome email:", error);
        }
      }
    }

    // Generate tokens (user cannot be null here)
    if (!user) {
      throw new AppError("Failed to create or find user", 500);
    }

    const accessToken = generateAccessToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken,
      user: this.formatUserResponse(user),
      isNewUser,
    };
  }

  async requestPasswordReset(
    data: ForgotPasswordDTO
  ): Promise<ForgotPasswordResponse> {
    // Find user by email
    const user = await authRepository.findByEmail(data.email);
    if (!user) {
      // Don't reveal if email exists - security best practice
      return {
        message:
          "If an account with that email exists, a password reset link has been sent.",
      };
    }

    // Generate reset token (random string)
    const resetToken = nanoid(64); // 64 characters random string
    const resetExpiry = new Date();
    resetExpiry.setMinutes(resetExpiry.getMinutes() + 30); // 30 minutes expiry

    // Save reset token and expiry to database
    await authRepository.updateUser(user.id, {
      resetPasswordToken: resetToken,
      resetPasswordExpiry: resetExpiry,
    });

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(
        user.email,
        user.displayName,
        resetToken
      );
      logger.info(`Password reset email sent to ${user.email}`);
    } catch (error) {
      logger.error("Failed to send password reset email:", error);
      throw new AppError(
        "Failed to send password reset email. Please try again.",
        500
      );
    }

    return {
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  }

  async resetPassword(data: ResetPasswordDTO): Promise<ResetPasswordResponse> {
    // Find user by reset token
    const user = await authRepository.findByResetToken(data.token);
    if (!user) {
      throw new AppError(
        "Invalid or expired reset token. Please request a new password reset.",
        400
      );
    }

    // Check if token is expired (extra validation)
    if (user.resetPasswordExpiry && user.resetPasswordExpiry < new Date()) {
      throw new AppError(
        "Reset token has expired. Please request a new password reset.",
        400
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(data.newPassword);

    // Update password and clear reset token
    await authRepository.updatePassword(user.id, hashedPassword);

    logger.info(`Password reset successful for user: ${user.email}`);

    return {
      message: "Password has been reset successfully. You can now login.",
    };
  }

  /**
   * Xác minh User qua Firebase Auth (The "Gold" Flow)
   */
  async verifyFirebaseUser(idToken: string) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid, phone_number } = decodedToken;

      if (!phone_number) {
        throw new AppError("Token does not contain a phone number. Please sign in with a phone number.", 400);
      }

      let user = await authRepository.findByPhoneNumber(phone_number);

      if (!user) {
        // Lấy thông tin Tên, Email, Pass từ tempStorage (đã được gọi qua `/register`)
        const pendingReg = tempStorage.get(phone_number);

        user = await authRepository.createUser({
          uid: uid,
          phoneNumber: phone_number,
          email: pendingReg ? pendingReg.email : `${uid}@firebase.local`, // Tránh lỗi unique nếu không có email
          password: pendingReg ? pendingReg.password : "", 
          displayName: pendingReg ? pendingReg.displayName : "Người dùng mới",
          photoURL: pendingReg?.photoURL || undefined,
          isVerified: true,
        });

        // Xóa thông tin tạm sau khi đã đăng ký thành công
        if (pendingReg) tempStorage.delete(phone_number);
      } else {
        // If found: Update the lastLogin timestamp
        await authRepository.updateLastLogin(user.id);
      }

      if (!user) {
        throw new AppError("Failed to verify user representation", 500);
      }

      const accessToken = generateAccessToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
      });

      return {
        success: true,
        user: this.formatUserResponse(user),
        token: { accessToken, refreshToken },
      };
    } catch (error: any) {
      logger.error("Failed to verify firebase token:", error);
      throw new AppError("Invalid or expired Firebase token. " + error.message, 401);
    }
  }
}

export const authService = new AuthService();
