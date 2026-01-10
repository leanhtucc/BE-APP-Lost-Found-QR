import { nanoid } from "nanoid";
import { AuthRepository } from "./auth.repository";
import {
  RegisterDTO,
  LoginDTO,
  AuthResponse,
  UserResponse,
  UpdateProfileDTO,
  VerifyEmailDTO,
  ResendVerificationDTO,
} from "./auth.types";
import { hashPassword, comparePassword } from "../../utils/hash";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../libs/jwt";
import { AppError } from "../../middlewares/error.middleware";
import { emailService } from "../../libs/email";
import { logger } from "../../libs/logger";

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

  asyncGenerate verification code
    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = this.getCodeExpiry();

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
      isVerified: false,
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        user.email,
        user.displayName,
        verificationCode
      );
      logger.info(`Verification email sent to ${user.email}`);
    } catch (error) {
      logger.error("Failed to send verification email:", error);
      // Không throw error, cho phép user đăng ký thành công
    }

    // Generate tokens (user chưa verified vẫn có thể login nhưng bị giới hạn chức năng)h unique uid
    const uid = `user_${nanoid(16)}`;
    const user = await authRepository.createUser({
      uid,
      email: data.email,
      password: hashedPassword,
      displayName: data.displayName,
      photoURL: data.photoURL,
    });

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
    };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    // Find user by email
    const user = await authRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // Verify password
    const isValidPassword = await comparePassword(
      data.password,
      user.password
    );
    if (!isValidPassword) {
      throw new AppError("Invalid email or password", 401);
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
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
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
        user: this.formatUserResponse(user),
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

  async updateProfile(

  async verifyEmail(data: VerifyEmailDTO): Promise<{ message: string }> {
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
      throw new AppError("Verification code expired", 400);
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

    return { message: "Email verified successfully" };
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
}
