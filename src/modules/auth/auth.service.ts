import { User } from "@prisma/client";
import { nanoid } from "nanoid";
import { emailService } from "../../libs/email";
import { googleOAuthService } from "../../libs/google-oauth";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../libs/jwt";
import { logger } from "../../libs/logger";
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
  RegisterDTO,
  RegisterResponse,
  ResendVerificationDTO,
  ResetPasswordDTO,
  ResetPasswordResponse,
  UpdateProfileDTO,
  UserResponse,
  VerifyEmailDTO,
  VerifyEmailResponse,
} from "./auth.types";

/**
 * Auth Service
 * Business logic for authentication
 */

const authRepository = new AuthRepository();

export class AuthService {
  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      totalReturned: user.totalReturned,
      createdAt: user.createdAt,
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
    // Check if email exists in database
    const existingUser = await authRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError("Email already registered", 400);
    }

    // Check if email has pending registration
    if (tempStorage.has(data.email)) {
      throw new AppError(
        "Verification code already sent. Please check your email or wait 15 minutes to resend.",
        400
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Generate verification code
    const verificationCode = this.generateVerificationCode();
    const expiresAt = this.getCodeExpiry();

    // Save to temporary storage (NOT database yet)
    tempStorage.set(data.email, {
      email: data.email,
      password: hashedPassword,
      displayName: data.displayName,
      photoURL: data.photoURL,
      verificationCode,
      expiresAt,
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        data.email,
        data.displayName,
        verificationCode
      );
      logger.info(
        `Verification code sent to ${data.email}. User will be created after verification.`
      );
    } catch (error) {
      // Remove from temp storage if email fails
      tempStorage.delete(data.email);
      logger.error("Failed to send verification email:", error);
      throw new AppError(
        "Failed to send verification email. Please try again.",
        500
      );
    }

    return {
      message:
        "Verification code sent! Please check your email and verify to complete registration.",
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

  async verifyEmail(data: VerifyEmailDTO): Promise<VerifyEmailResponse> {
    // Check temp storage for pending registration
    const pendingReg = tempStorage.get(data.email);
    if (!pendingReg) {
      throw new AppError(
        "No pending registration found. Please register first or request a new verification code.",
        404
      );
    }

    // Verify code
    if (pendingReg.verificationCode !== data.code) {
      throw new AppError("Invalid verification code", 400);
    }

    // Check if code expired
    if (new Date() > pendingReg.expiresAt) {
      tempStorage.delete(data.email);
      throw new AppError(
        "Verification code expired. Please register again.",
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
      isVerified: true, // Already verified
      verificationCode: undefined,
      verificationCodeExpiry: undefined,
    });

    // Remove from temp storage
    tempStorage.delete(data.email);

    logger.info(
      `User ${user.email} created successfully after email verification`
    );

    // Send welcome email
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
      message: "Email verified successfully! Account created.",
      accessToken,
      refreshToken,
    };
  }

  async resendVerificationCode(
    data: ResendVerificationDTO
  ): Promise<{ message: string }> {
    // Check if user already exists in database
    const existingUser = await authRepository.findByEmail(data.email);
    if (existingUser) {
      if (existingUser.isVerified) {
        throw new AppError("Email already verified", 400);
      }
      throw new AppError("User already exists. Please use login instead.", 400);
    }

    // Check temp storage
    const pendingReg = tempStorage.get(data.email);
    if (!pendingReg) {
      throw new AppError(
        "No pending registration found. Please register first.",
        404
      );
    }

    // Generate new code
    const verificationCode = this.generateVerificationCode();
    const expiresAt = this.getCodeExpiry();

    // Update temp storage with new code
    tempStorage.set(data.email, {
      ...pendingReg,
      verificationCode,
      expiresAt,
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        data.email,
        pendingReg.displayName,
        verificationCode
      );
      logger.info(`Verification code resent to ${data.email}`);
    } catch (error) {
      logger.error("Failed to resend verification email:", error);
      throw new AppError("Failed to send verification email", 500);
    }

    return { message: "Verification code sent successfully" };
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
      // Verify Google token and get user info
      const googleUser = await googleOAuthService.verifyToken(code);

      if (!googleUser.verified_email) {
        throw new AppError("Google email not verified", 400);
      }

      // Check if user exists with Google ID
      let user: User | null = await authRepository.findByGoogleId(
        googleUser.id
      );
      let isNewUser = false;

      if (!user) {
        // Check if user exists with same email
        user = await authRepository.findByEmail(googleUser.email);

        if (user) {
          // Link Google account to existing user
          await authRepository.updateUser(user.id, {
            googleId: googleUser.id,
            photoURL: googleUser.picture || user.photoURL,
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
            verificationCode: undefined,
            verificationCodeExpiry: undefined,
          });
          user = await authRepository.findByEmail(googleUser.email);
          isNewUser = true;
          logger.info(`New user created via Google OAuth: ${user!.email}`);
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
    } catch (error) {
      logger.error("Google OAuth error:", error);
      throw new AppError("Google authentication failed", 500);
    }
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
}

export const authService = new AuthService();
