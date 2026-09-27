import { User } from "../../generated/prisma/client";
import { randomInt } from "crypto";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { nanoid } from "nanoid";
import { ENV } from "../../config/env";
import admin from "../../config/firebaseAdmin";
import { emailService } from "../../libs/email";
import { googleOAuthService } from "../../libs/google-oauth";
import {
  decodeToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../libs/jwt";
import { logger } from "../../libs/logger";
import { redis } from "../../libs/redis";
import { createStreamUserToken } from "../../libs/stream-chat";
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
  ProfileStatistics,
  ChangePasswordDTO,
  ConfirmAccountDeletionDTO,
} from "./auth.types";

/**
 * Auth Service
 * Business logic for authentication
 */

const authRepository = new AuthRepository();

export class AuthService {
  private formatUserResponse(
    user: any,
    profileStatistics?: ProfileStatistics
  ): UserResponse {
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

    const id = String(user.id || user.uid || "");
    const rawUid = user.uid ? String(user.uid).replace("user_", "") : id;
    const memberId = String(user.memberId || `USER_${rawUid}`);
    const displayName = String(
      user.displayName || user.full_name || user.name || ""
    );
    const email = String(user.email || "");
    const phoneNumber = user.phoneNumber || user.phone || null;
    const photoURL = user.photoURL || user.avatar_url || user.avatar || null;
    const address = user.addressCity || user.address || null;
    const bio = user.bio || null;
    const isVerified = Boolean(user.isVerified);

    let trustScore = 50;
    if (typeof user.trustScore === "number") {
      trustScore =
        user.trustScore <= 5
          ? Math.round(user.trustScore * 20)
          : user.trustScore;
    }

    const totalReturned =
      typeof user.totalReturned === "number" ? user.totalReturned : 0;
    const itemsLost = typeof user.itemsLost === "number" ? user.itemsLost : 0;
    trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));
    const trustLevel =
      trustScore >= 90
        ? "PLATINUM"
        : trustScore >= 70
          ? "GOLD"
          : trustScore >= 50
            ? "SILVER"
            : "BRONZE";

    const authProvider = user.password
      ? "password"
      : user.googleId
        ? "google"
        : user.phoneNumber
          ? "firebase_phone"
          : "apple";

    const preference = user.notificationPreference;
    const preferences = {
      pushEnabled: preference?.pushEnabled ?? true,
      emailEnabled: preference?.emailEnabled ?? false,
      proximityEnabled: preference?.proximityEnabled ?? true,
      notificationRadiusMeters: preference?.notificationRadiusMeters ?? 3000,
      language: (preference?.language === "en" ? "en" : "vi") as "vi" | "en",
    };

    const statistics: ProfileStatistics = profileStatistics || {
      protectedItems: 0,
      safeItems: 0,
      lostItems: itemsLost,
      activeLostReports: 0,
      completedReturns: totalReturned,
      qrScans: 0,
    };

    const createdAtIso =
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : typeof user.createdAt === "string"
          ? user.createdAt
          : new Date().toISOString();
    const updatedAtIso =
      user.updatedAt instanceof Date
        ? user.updatedAt.toISOString()
        : typeof user.updatedAt === "string"
          ? user.updatedAt
          : createdAtIso;

    return {
      // Exact fields expected by Frontend (ProfileScreen, UserInfoCard, OwnerInfoCard)
      id,
      memberId,
      displayName,
      email,
      phoneNumber,
      photoURL,
      address,
      bio,
      authProvider,
      emailVerified: isVerified,
      isVerified,
      trustScore,
      totalReturned,
      itemsLost,
      createdAt: createdAtIso,
      updatedAt: updatedAtIso,
      trust: {
        score: trustScore,
        level: trustLevel,
        isVerified,
        completedReturns: statistics.completedReturns,
      },
      preferences,

      // Backward compatibility aliases
      member_id: memberId,
      full_name: displayName,
      phone: phoneNumber,
      avatar_url: photoURL,
      is_verified: isVerified,
      stats: {
        trust_score: trustScore,
        items_lost: itemsLost,
        items_returned: totalReturned,
        ...statistics,
      },
      stream_token: streamToken,
      privacy_settings: privacySettings,
      created_at: createdAtIso,
    };
  }

  private generateVerificationCode(): string {
    return randomInt(100000, 1_000_000).toString();
  }

  private getCodeExpiry(): Date {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15); // 15 phút
    return expiry;
  }

  private getTokenLifetimeSeconds(token: string): number {
    const decoded = decodeToken(token);

    if (
      !decoded ||
      typeof decoded === "string" ||
      typeof decoded.iat !== "number" ||
      typeof decoded.exp !== "number"
    ) {
      throw new AppError("Failed to determine token expiration", 500);
    }

    return decoded.exp - decoded.iat;
  }

  private getPhoneCandidates(phoneNumber: string): string[] {
    const normalizedInput = String(phoneNumber || "").trim();
    const digits = normalizedInput.replace(/\D/g, "");
    const candidates = new Set<string>();

    if (normalizedInput) {
      candidates.add(normalizedInput);
    }

    if (!digits) {
      return [...candidates];
    }

    if (digits.startsWith("84")) {
      candidates.add(`+${digits}`);
      candidates.add(`0${digits.slice(2)}`);
    } else if (digits.startsWith("0")) {
      candidates.add(digits);
      candidates.add(`+84${digits.slice(1)}`);
    } else {
      candidates.add(digits);
      candidates.add(`+${digits}`);
    }

    return [...candidates];
  }

  async register(data: RegisterDTO): Promise<RegisterResponse> {
    const email = data.email.trim().toLowerCase();

    const existingUser = await authRepository.findByEmail(email);
    if (existingUser) {
      if (existingUser.googleId && !existingUser.password) {
        throw new AppError(
          "This email is already registered with Google. Please sign in with Google or use forgot password to set a password.",
          400
        );
      }
      throw new AppError("Email already registered", 400);
    }

    if (await tempStorage.has(email)) {
      throw new AppError(
        "Verification code already sent. Please check your email or wait to resend.",
        400
      );
    }

    const hashedPassword = await hashPassword(data.password);
    const verificationCode = this.generateVerificationCode();
    const expiresAt = this.getCodeExpiry();

    await tempStorage.set(email, {
      email,
      password: hashedPassword,
      displayName: data.displayName,
      verificationCode,
      verificationAttempts: 0,
      expiresAt: expiresAt.toISOString(),
    });

    const emailSent = await emailService.sendVerificationEmail(
      email,
      data.displayName,
      verificationCode
    );

    if (
      !emailSent &&
      (!ENV.SKIP_EMAIL_VERIFICATION || emailService.isConfigured())
    ) {
      await tempStorage.delete(email);
      throw new AppError("Failed to send verification email", 502);
    }

    return {
      message: emailSent
        ? "OTP code has been sent to your email."
        : "SMTP is not configured; OTP email was skipped in development mode.",
      email,
      otpExpiresIn: 15 * 60,
    };
  }

  async login(data: LoginDTO): Promise<LoginResponse> {
    const email = data.email.trim().toLowerCase();

    // Find user by email
    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }
    if (user.scheduledDeletionAt) {
      throw new AppError("Account is not active", 401, true, "UNAUTHORIZED");
    }

    // Verify password
    if (!user.password) {
      if (user.googleId) {
        throw new AppError(
          "This account is registered with Google. Please sign in with Google or reset your password to create a password.",
          401
        );
      }
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
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    return {
      accessToken,
      refreshToken,
      user: this.formatUserResponse(user),
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Get user
      const user = await authRepository.findById(decoded.id);
      if (!user || user.scheduledDeletionAt) {
        throw new AppError("Account is not active", 401, true, "UNAUTHORIZED");
      }
      if ((decoded.tokenVersion ?? 0) !== user.tokenVersion) {
        throw new AppError(
          "Session has been revoked",
          401,
          true,
          "REFRESH_TOKEN_REVOKED"
        );
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
        tokenVersion: user.tokenVersion,
      });

      const newRefreshToken = generateRefreshToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
        tokenVersion: user.tokenVersion,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: this.formatUserResponse(user),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof TokenExpiredError) {
        throw new AppError(
          "Refresh token expired",
          401,
          true,
          "REFRESH_TOKEN_EXPIRED"
        );
      }
      if (error instanceof JsonWebTokenError) {
        throw new AppError(
          "Invalid refresh token",
          401,
          true,
          "INVALID_REFRESH_TOKEN"
        );
      }
      throw error;
    }
  }

  async logout(userId: string): Promise<void> {
    await authRepository.revokeTokens(userId);
  }

  async getProfile(userId: string): Promise<UserResponse> {
    const profile = await authRepository.findProfileById(userId);
    if (!profile) {
      throw new AppError("Profile not found", 404, true, "PROFILE_NOT_FOUND");
    }

    return this.formatUserResponse(profile.user, profile.statistics);
  }

  async verifyOtp(data: VerifyOtpDTO): Promise<VerifyOtpResponse> {
    const email = data.email.trim().toLowerCase();
    const pendingReg = await tempStorage.get(email);

    if (!pendingReg) {
      throw new AppError(
        "No pending registration found for this email. Please register first.",
        404
      );
    }

    if (pendingReg.verificationCode !== data.code) {
      pendingReg.verificationAttempts += 1;

      if (pendingReg.verificationAttempts >= 5) {
        await tempStorage.delete(email);
        throw new AppError(
          "Too many invalid OTP attempts. Please register again.",
          429
        );
      }

      await tempStorage.set(email, pendingReg);
      throw new AppError("Invalid OTP code", 400);
    }

    if (new Date() > new Date(pendingReg.expiresAt)) {
      await tempStorage.delete(email);
      throw new AppError(
        "Verification code has expired. Please register again.",
        400
      );
    }

    const uid = `user_${nanoid(16)}`;
    const user = await authRepository.createUser({
      uid,
      email: pendingReg.email,
      password: pendingReg.password,
      displayName: pendingReg.displayName,
      isVerified: true,
      verificationCode: undefined,
      verificationCodeExpiry: undefined,
    });

    await tempStorage.delete(email);
    logger.info(
      `User ${user.email} created successfully after email verification`
    );

    try {
      await emailService.sendWelcomeEmail(user.email, user.displayName);
    } catch (error) {
      logger.error("Failed to send welcome email:", error);
    }

    const accessToken = generateAccessToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });
    const refreshToken = generateRefreshToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    return {
      access_token: accessToken,
      expire_in: this.getTokenLifetimeSeconds(accessToken),
      refresh_token: refreshToken,
      refresh_token_expire_in: this.getTokenLifetimeSeconds(refreshToken),
      auth_type: "Bearer Token",
      user: this.formatUserResponse(user),
    };
  }

  async resendOtp(data: ResendOtpDTO): Promise<{ message: string }> {
    const email = data.email.trim().toLowerCase();
    const pendingReg = await tempStorage.get(email);

    if (!pendingReg) {
      throw new AppError(
        "No pending registration found. Please register again.",
        404
      );
    }

    // createdAt is stored as ISO string from Redis; parse before arithmetic
    if (Date.now() - new Date(pendingReg.createdAt).getTime() < 60_000) {
      throw new AppError(
        "Please wait 60 seconds before requesting another OTP.",
        429
      );
    }

    const verificationCode = this.generateVerificationCode();
    const expiresAt = this.getCodeExpiry();
    const emailSent = await emailService.sendVerificationEmail(
      pendingReg.email,
      pendingReg.displayName,
      verificationCode
    );

    if (
      !emailSent &&
      (!ENV.SKIP_EMAIL_VERIFICATION || emailService.isConfigured())
    ) {
      throw new AppError("Failed to resend verification email", 502);
    }

    await tempStorage.set(email, {
      ...pendingReg,
      verificationCode,
      verificationAttempts: 0,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      message: emailSent
        ? "A new OTP code has been sent to your email."
        : "SMTP is not configured; OTP email was skipped in development mode.",
    };
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDTO
  ): Promise<UserResponse> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError("Profile not found", 404, true, "PROFILE_NOT_FOUND");
    }

    if (
      data.phoneNumber &&
      (await authRepository.findPhoneOwner(data.phoneNumber, userId))
    ) {
      throw new AppError(
        "Phone number is already in use",
        409,
        true,
        "PHONE_ALREADY_USED"
      );
    }

    const payload: any = { ...data };
    if (data.address !== undefined && payload.addressCity === undefined) {
      payload.addressCity = data.address;
    }
    delete payload.address;

    await authRepository.updateUser(userId, payload);
    await authRepository.createAuditLog(userId, "PROFILE_UPDATED", {
      fields: Object.entries(data)
        .filter(
          ([field, value]) => field !== "pushToken" && value !== undefined
        )
        .map(([field]) => field),
    });
    return this.getProfile(userId);
  }

  async getProfileStatistics(userId: string): Promise<ProfileStatistics> {
    const profile = await authRepository.findProfileById(userId);
    if (!profile) {
      throw new AppError("Profile not found", 404, true, "PROFILE_NOT_FOUND");
    }
    return profile.statistics;
  }

  async changePassword(userId: string, data: ChangePasswordDTO): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError("Profile not found", 404, true, "PROFILE_NOT_FOUND");
    }
    if (!user.password) {
      throw new AppError(
        "This account does not use a password",
        403,
        true,
        "PASSWORD_NOT_SUPPORTED_FOR_PROVIDER"
      );
    }
    if (!(await comparePassword(data.currentPassword, user.password))) {
      throw new AppError(
        "Current password is incorrect",
        401,
        true,
        "UNAUTHORIZED"
      );
    }

    const hashedPassword = await hashPassword(data.newPassword);
    await authRepository.updatePassword(userId, hashedPassword, true);
    await emailService.sendPasswordChangedEmail(user.email, user.displayName);
  }

  async requestAccountDeletionOtp(userId: string): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError("Profile not found", 404, true, "PROFILE_NOT_FOUND");
    }

    const otpCode = this.generateVerificationCode();
    const otpHash = await hashPassword(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await redis.set(
      `otp:account-deletion:${userId}`,
      { otpHash, attempts: 0, expiresAt },
      10 * 60
    );
    await authRepository.createAuditLog(
      userId,
      "ACCOUNT_DELETION_OTP_REQUESTED"
    );
    await emailService.sendAccountDeletionOtpEmail(
      user.email,
      user.displayName,
      otpCode
    );
  }

  async confirmAccountDeletion(
    userId: string,
    data: ConfirmAccountDeletionDTO
  ): Promise<{ scheduledDeletionAt: string; recoverableUntil: string }> {
    const key = `otp:account-deletion:${userId}`;
    const stored = await redis.get<{
      otpHash: string;
      attempts: number;
      expiresAt: string;
    }>(key);
    if (!stored || new Date(stored.expiresAt) <= new Date()) {
      await redis.del(key);
      throw new AppError(
        "Deletion verification code is invalid or expired",
        403,
        true,
        "REAUTHENTICATION_REQUIRED"
      );
    }

    const valid = await comparePassword(data.otpCode, stored.otpHash);
    if (!valid) {
      const attempts = stored.attempts + 1;
      if (attempts >= 5) {
        await redis.del(key);
      } else {
        const remainingSeconds = Math.max(
          1,
          Math.ceil((new Date(stored.expiresAt).getTime() - Date.now()) / 1000)
        );
        await redis.set(key, { ...stored, attempts }, remainingSeconds);
      }
      throw new AppError(
        "Deletion verification code is invalid or expired",
        403,
        true,
        "REAUTHENTICATION_REQUIRED"
      );
    }

    await redis.del(key);
    const scheduledDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await authRepository.scheduleAccountDeletion(userId, scheduledDeletionAt);

    return {
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      recoverableUntil: scheduledDeletionAt.toISOString(),
    };
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
      const admin: any = (await import("../../config/firebaseAdmin.js"))
        .default;

      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid, phone_number, email, picture, name } = decodedToken;

      let user = await authRepository.findByUid(uid);
      let isNewUser = false;
      const normalizedEmail = email ? email.trim().toLowerCase() : null;

      if (!user && normalizedEmail) {
        user = await authRepository.findByEmail(normalizedEmail);

        if (user) {
          // Link Firebase account to existing user
          const googleIdCandidate =
            decodedToken.firebase?.identities?.["google.com"]?.[0];

          await authRepository.updateUser(user.id, {
            photoURL: user.photoURL || picture || undefined,
            phoneNumber: user.phoneNumber || phone_number || undefined,
            googleId: user.googleId || googleIdCandidate || undefined,
            isVerified: true,
          });
          user = await authRepository.findByEmail(normalizedEmail);
          logger.info(
            `Firebase account linked to existing user: ${user!.email}`
          );
        }
      }

      if (!user) {
        const actualEmail = normalizedEmail || `${uid}@firebase.app`;

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

      if (user.scheduledDeletionAt) {
        throw new AppError("Account is not active", 401, true, "UNAUTHORIZED");
      }

      const accessToken = generateAccessToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
        tokenVersion: user.tokenVersion,
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
        tokenVersion: user.tokenVersion,
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
      if (error.code && String(error.code).startsWith("auth/")) {
        throw new AppError("Invalid or expired Firebase ID Token", 401);
      }
      if (error instanceof AppError) {
        throw error;
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

    const email = googleUser.email.trim().toLowerCase();

    // Check if user exists with Google ID
    let user: User | null = await authRepository.findByGoogleId(googleUser.id);
    let isNewUser = false;

    if (!user) {
      // Check if user exists with same email (case-insensitive normalized)
      user = await authRepository.findByEmail(email);

      if (user) {
        // Link Google account to existing user
        await authRepository.updateUser(user.id, {
          googleId: googleUser.id,
          photoURL: user.photoURL || googleUser.picture || undefined,
          isVerified: true, // Auto-verify Google users
        });
        await tempStorage.delete(email);
        user = await authRepository.findByEmail(email);
        logger.info(`Google account linked to existing user: ${user!.email}`);
      } else {
        // Create new user with Google account
        const uid = `user_${nanoid(16)}`;
        await authRepository.createUser({
          uid,
          email: email,
          password: "", // Empty string for OAuth users
          displayName: googleUser.name,
          photoURL: googleUser.picture || undefined,
          isVerified: true, // Auto-verify Google users
          googleId: googleUser.id,
          verificationCode: undefined,
          verificationCodeExpiry: undefined,
        });
        await tempStorage.delete(email);
        user = await authRepository.findByEmail(email);
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

    if (!user) {
      throw new AppError("Failed to create or find user", 500);
    }

    if (user.scheduledDeletionAt) {
      throw new AppError("Account is not active", 401, true, "UNAUTHORIZED");
    }

    const accessToken = generateAccessToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
      tokenVersion: user.tokenVersion,
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
    const email = data.email.trim().toLowerCase();

    // Find user by email
    const user = await authRepository.findByEmail(email);
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
    await authRepository.updatePassword(user.id, hashedPassword, true);

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
        if (decodedToken.email) {
          const result = await this.verifyFirebaseToken(idToken);
          return {
            ...result,
            token: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
            },
          };
        }
        throw new AppError(
          "Token does not contain a phone number or email.",
          400
        );
      }

      const phoneCandidates = this.getPhoneCandidates(phone_number);
      let user: any = null;

      for (const candidate of phoneCandidates) {
        user = await authRepository.findByPhoneNumber(candidate);
        if (user) break;
      }

      let isNewUser = false;

      if (!user) {
        // Lấy thông tin Tên, Email, Pass từ tempStorage (đã được gọi qua `/register`)
        let pendingReg = null;
        let matchedPendingPhone = phone_number;

        for (const candidate of phoneCandidates) {
          const foundPending = await tempStorage.get(candidate);
          if (foundPending) {
            pendingReg = foundPending;
            matchedPendingPhone = candidate;
            break;
          }
        }

        const createdUser = await authRepository.createUser({
          uid: uid,
          phoneNumber: pendingReg?.phoneNumber || phone_number,
          email: pendingReg ? pendingReg.email : `${uid}@firebase.local`, // Tránh lỗi unique nếu không có email
          password: pendingReg ? pendingReg.password : "",
          displayName: pendingReg ? pendingReg.displayName : "Người dùng mới",
          photoURL: pendingReg?.photoURL || undefined,
          isVerified: true,
        });

        user = await authRepository.findByUid(createdUser.uid);
        isNewUser = true;

        // Xóa thông tin tạm sau khi đã đăng ký thành công
        if (pendingReg) await tempStorage.delete(matchedPendingPhone);
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
        tokenVersion: user.tokenVersion,
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
        tokenVersion: user.tokenVersion,
      });

      const responseData = {
        accessToken,
        refreshToken,
        user: this.formatUserResponse(user),
        isNewUser,
      };

      return {
        ...responseData,
        // Keep legacy shape for older mobile clients while exposing flat tokens.
        token: { accessToken, refreshToken },
      };
    } catch (error: any) {
      logger.error("Failed to verify firebase token:", error);
      throw new AppError(
        "Invalid or expired Firebase token. " + error.message,
        401
      );
    }
  }
}

export const authService = new AuthService();
