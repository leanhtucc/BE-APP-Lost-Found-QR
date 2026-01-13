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
import { AppError } from "../../middlewares/error.middleware";
import { comparePassword, hashPassword } from "../../utils/hash";
import { AuthRepository } from "./auth.repository";
import {
  GoogleAuthResponse,
  LoginDTO,
  LoginResponse,
  RegisterDTO,
  RegisterResponse,
  ResendVerificationDTO,
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
    // Check if email exists
    const existingUser = await authRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError("Email already registered", 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Check if skip email verification (dev mode)
    const skipVerification = ENV.SKIP_EMAIL_VERIFICATION;

    // Generate verification code (only if not skipping)
    const verificationCode = skipVerification
      ? null
      : this.generateVerificationCode();
    const verificationCodeExpiry = skipVerification
      ? null
      : this.getCodeExpiry();

    // Create user with unique uid
    const uid = `user_${nanoid(16)}`;
    const user = await authRepository.createUser({
      uid,
      email: data.email,
      password: hashedPassword,
      displayName: data.displayName,
      photoURL: data.photoURL,
      verificationCode,
      verificationCodeExpiry,
      isVerified: skipVerification, // Auto-verify in dev mode
    });

    // Skip email in dev mode
    if (skipVerification) {
      logger.info(`[DEV MODE] Email verification skipped for ${user.email}`);

      // Generate tokens immediately
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
        message:
          "Registration successful! (Dev mode - email verification skipped)",
        email: user.email,
        accessToken,
        refreshToken,
      };
    }

    // Send verification email (production mode)
    try {
      await emailService.sendVerificationEmail(
        user.email,
        user.displayName,
        verificationCode!
      );
      logger.info(`Verification email sent to ${user.email}`);
    } catch (error) {
      logger.error("Failed to send verification email:", error);
      throw new AppError(
        "Failed to send verification email. Please try again.",
        500
      );
    }

    return {
      message:
        "Registration successful! Please check your email for verification code.",
      email: user.email,
    };
  }

  async login(data: LoginDTO): Promise<LoginResponse> {
    // Find user by email
    const user = await authRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // Verify password
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
    const user = await authRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.isVerified) {
      throw new AppError("Email already verified", 400);
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      throw new AppError("Verification code not found", 400);
    }

    // Check if code expired
    if (new Date() > user.verificationCodeExpiry) {
      throw new AppError(
        "Verification code expired. Please request a new code.",
        400
      );
    }

    // Verify code
    if (user.verificationCode !== data.code) {
      throw new AppError("Invalid verification code", 400);
    }

    // Update user as verified
    await authRepository.updateUser(user.id, {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiry: null,
    });

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.displayName);
    } catch (error) {
      logger.error("Failed to send welcome email:", error);
    }

    // Generate tokens after successful verification
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
      message: "Email verified successfully! You can now use the app.",
      accessToken,
      refreshToken,
    };
  }

  async resendVerificationCode(
    data: ResendVerificationDTO
  ): Promise<{ message: string }> {
    const user = await authRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.isVerified) {
      throw new AppError("Email already verified", 400);
    }

    // Generate new code
    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = this.getCodeExpiry();

    // Update user with new code
    await authRepository.updateUser(user.id, {
      verificationCode,
      verificationCodeExpiry,
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        user.email,
        user.displayName,
        verificationCode
      );
      logger.info(`Verification code resent to ${user.email}`);
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
      let user = await authRepository.findByGoogleId(googleUser.id);
      let isNewUser = false;

      if (!user) {
        // Check if user exists with same email
        user = await authRepository.findByEmail(googleUser.email);

        if (user) {
          // Link Google account to existing user
          user = await authRepository.updateUser(user.id, {
            googleId: googleUser.id,
            photoURL: googleUser.picture || user.photoURL,
            isVerified: true, // Auto-verify Google users
          });
          logger.info(`Google account linked to existing user: ${user.email}`);
        } else {
          // Create new user with Google account
          const uid = `user_${nanoid(16)}`;
          user = await authRepository.createUser({
            uid,
            email: googleUser.email,
            password: null, // No password for OAuth users
            displayName: googleUser.name,
            photoURL: googleUser.picture,
            googleId: googleUser.id,
            isVerified: true, // Auto-verify Google users
            verificationCode: null,
            verificationCodeExpiry: null,
          });
          isNewUser = true;
          logger.info(`New user created via Google OAuth: ${user.email}`);
        }
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
        user: this.formatUserResponse(user),
        isNewUser,
      };
    } catch (error) {
      logger.error("Google OAuth error:", error);
      throw new AppError("Google authentication failed", 500);
    }
  }
}

export const authService = new AuthService();
