"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const nanoid_1 = require("nanoid");
const email_1 = require("../../libs/email");
const google_oauth_1 = require("../../libs/google-oauth");
const jwt_1 = require("../../libs/jwt");
const logger_1 = require("../../libs/logger");
const error_middleware_1 = require("../../middlewares/error.middleware");
const hash_1 = require("../../utils/hash");
const auth_repository_1 = require("./auth.repository");
/**
 * Auth Service
 * Business logic for authentication
 */
const authRepository = new auth_repository_1.AuthRepository();
class AuthService {
    formatUserResponse(user) {
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
    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    getCodeExpiry() {
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 15); // 15 phút
        return expiry;
    }
    async register(data) {
        // Check if email exists
        const existingUser = await authRepository.findByEmail(data.email);
        if (existingUser) {
            throw new error_middleware_1.AppError("Email already registered", 400);
        }
        // Hash password
        const hashedPassword = await (0, hash_1.hashPassword)(data.password);
        // Generate verification code
        const verificationCode = this.generateVerificationCode();
        const verificationCodeExpiry = this.getCodeExpiry();
        // Create user with unique uid
        const uid = `user_${(0, nanoid_1.nanoid)(16)}`;
        const user = await authRepository.createUser({
            uid,
            email: data.email,
            password: hashedPassword,
            displayName: data.displayName,
            photoURL: data.photoURL || undefined,
            verificationCode,
            verificationCodeExpiry,
            isVerified: false,
        });
        // Send verification email
        try {
            await email_1.emailService.sendVerificationEmail(user.email, user.displayName, verificationCode);
            logger_1.logger.info(`Verification email sent to ${user.email}`);
        }
        catch (error) {
            logger_1.logger.error("Failed to send verification email:", error);
            throw new error_middleware_1.AppError("Failed to send verification email. Please try again.", 500);
        }
        return {
            message: "Registration successful! Please check your email for verification code.",
            email: user.email,
        };
    }
    async login(data) {
        // Find user by email
        const user = await authRepository.findByEmail(data.email);
        if (!user) {
            throw new error_middleware_1.AppError("Invalid email or password", 401);
        }
        // Verify password
        if (!user.password) {
            throw new error_middleware_1.AppError("Invalid email or password", 401);
        }
        const isValidPassword = await (0, hash_1.comparePassword)(data.password, user.password);
        if (!isValidPassword) {
            throw new error_middleware_1.AppError("Invalid email or password", 401);
        }
        // Check if email is verified
        if (!user.isVerified) {
            throw new error_middleware_1.AppError("Please verify your email before logging in. Check your inbox for the verification code.", 403);
        }
        // Generate tokens
        const accessToken = (0, jwt_1.generateAccessToken)({
            id: user.id,
            uid: user.uid,
            email: user.email,
        });
        const refreshToken = (0, jwt_1.generateRefreshToken)({
            id: user.id,
            uid: user.uid,
            email: user.email,
        });
        return {
            accessToken,
            refreshToken,
        };
    }
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
            // Get user
            const user = await authRepository.findById(decoded.id);
            if (!user) {
                throw new error_middleware_1.AppError("User not found", 404);
            }
            // Generate new tokens
            const newAccessToken = (0, jwt_1.generateAccessToken)({
                id: user.id,
                uid: user.uid,
                email: user.email,
            });
            const newRefreshToken = (0, jwt_1.generateRefreshToken)({
                id: user.id,
                uid: user.uid,
                email: user.email,
            });
            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            };
        }
        catch (error) {
            throw new error_middleware_1.AppError("Invalid refresh token", 401);
        }
    }
    async getProfile(userId) {
        const user = await authRepository.findById(userId);
        if (!user) {
            throw new error_middleware_1.AppError("User not found", 404);
        }
        return this.formatUserResponse(user);
    }
    async verifyEmail(data) {
        const user = await authRepository.findByEmail(data.email);
        if (!user) {
            throw new error_middleware_1.AppError("User not found", 404);
        }
        if (user.isVerified) {
            throw new error_middleware_1.AppError("Email already verified", 400);
        }
        if (!user.verificationCode || !user.verificationCodeExpiry) {
            throw new error_middleware_1.AppError("Verification code not found", 400);
        }
        // Check if code expired
        if (new Date() > user.verificationCodeExpiry) {
            throw new error_middleware_1.AppError("Verification code expired. Please request a new code.", 400);
        }
        // Verify code
        if (user.verificationCode !== data.code) {
            throw new error_middleware_1.AppError("Invalid verification code", 400);
        }
        // Update user as verified
        await authRepository.updateUser(user.id, {
            isVerified: true,
            verificationCode: null,
            verificationCodeExpiry: null,
        });
        // Send welcome email
        try {
            await email_1.emailService.sendWelcomeEmail(user.email, user.displayName);
        }
        catch (error) {
            logger_1.logger.error("Failed to send welcome email:", error);
        }
        // Generate tokens after successful verification
        const accessToken = (0, jwt_1.generateAccessToken)({
            id: user.id,
            uid: user.uid,
            email: user.email,
        });
        const refreshToken = (0, jwt_1.generateRefreshToken)({
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
    async resendVerificationCode(data) {
        const user = await authRepository.findByEmail(data.email);
        if (!user) {
            throw new error_middleware_1.AppError("User not found", 404);
        }
        if (user.isVerified) {
            throw new error_middleware_1.AppError("Email already verified", 400);
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
            await email_1.emailService.sendVerificationEmail(user.email, user.displayName, verificationCode);
            logger_1.logger.info(`Verification code resent to ${user.email}`);
        }
        catch (error) {
            logger_1.logger.error("Failed to resend verification email:", error);
            throw new error_middleware_1.AppError("Failed to send verification email", 500);
        }
        return { message: "Verification code sent successfully" };
    }
    async updateProfile(userId, data) {
        const user = await authRepository.findById(userId);
        if (!user) {
            throw new error_middleware_1.AppError("User not found", 404);
        }
        const updated = await authRepository.updateUser(userId, data);
        return this.formatUserResponse(updated);
    }
    async deleteAccount(userId) {
        const user = await authRepository.findById(userId);
        if (!user) {
            throw new error_middleware_1.AppError("User not found", 404);
        }
        await authRepository.deleteUser(userId);
    }
    async getGoogleAuthUrl() {
        return google_oauth_1.googleOAuthService.getAuthUrl();
    }
    async googleAuth(code) {
        try {
            // Verify Google token and get user info
            const googleUser = await google_oauth_1.googleOAuthService.verifyToken(code);
            if (!googleUser.verified_email) {
                throw new error_middleware_1.AppError("Google email not verified", 400);
            }
            // Check if user exists with Google ID
            let user = await authRepository.findByGoogleId(googleUser.id);
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
                    logger_1.logger.info(`Google account linked to existing user: ${user.email}`);
                }
                else {
                    // Create new user with Google account
                    const uid = `user_${(0, nanoid_1.nanoid)(16)}`;
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
                    logger_1.logger.info(`New user created via Google OAuth: ${user.email}`);
                }
            }
            // Generate tokens (user cannot be null here)
            if (!user) {
                throw new error_middleware_1.AppError("Failed to create or find user", 500);
            }
            const accessToken = (0, jwt_1.generateAccessToken)({
                id: user.id,
                uid: user.uid,
                email: user.email,
            });
            const refreshToken = (0, jwt_1.generateRefreshToken)({
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
        catch (error) {
            logger_1.logger.error("Google OAuth error:", error);
            throw new error_middleware_1.AppError("Google authentication failed", 500);
        }
    }
    async requestPasswordReset(data) {
        // Find user by email
        const user = await authRepository.findByEmail(data.email);
        if (!user) {
            // Don't reveal if email exists - security best practice
            return {
                message: "If an account with that email exists, a password reset link has been sent.",
            };
        }
        // Generate reset token (random string)
        const resetToken = (0, nanoid_1.nanoid)(64); // 64 characters random string
        const resetExpiry = new Date();
        resetExpiry.setMinutes(resetExpiry.getMinutes() + 30); // 30 minutes expiry
        // Save reset token and expiry to database
        await authRepository.updateUser(user.id, {
            resetPasswordToken: resetToken,
            resetPasswordExpiry: resetExpiry,
        });
        // Send password reset email
        try {
            await email_1.emailService.sendPasswordResetEmail(user.email, user.displayName, resetToken);
            logger_1.logger.info(`Password reset email sent to ${user.email}`);
        }
        catch (error) {
            logger_1.logger.error("Failed to send password reset email:", error);
            throw new error_middleware_1.AppError("Failed to send password reset email. Please try again.", 500);
        }
        return {
            message: "If an account with that email exists, a password reset link has been sent.",
        };
    }
    async resetPassword(data) {
        // Find user by reset token
        const user = await authRepository.findByResetToken(data.token);
        if (!user) {
            throw new error_middleware_1.AppError("Invalid or expired reset token. Please request a new password reset.", 400);
        }
        // Check if token is expired (extra validation)
        if (user.resetPasswordExpiry && user.resetPasswordExpiry < new Date()) {
            throw new error_middleware_1.AppError("Reset token has expired. Please request a new password reset.", 400);
        }
        // Hash new password
        const hashedPassword = await (0, hash_1.hashPassword)(data.newPassword);
        // Update password and clear reset token
        await authRepository.updatePassword(user.id, hashedPassword);
        logger_1.logger.info(`Password reset successful for user: ${user.email}`);
        return {
            message: "Password has been reset successfully. You can now login.",
        };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map