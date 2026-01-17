"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const response_1 = require("../../utils/response");
const auth_service_1 = require("./auth.service");
/**
 * Auth Controller
 * Handle authentication HTTP requests
 */
const authService = new auth_service_1.AuthService();
class AuthController {
    // POST /api/auth/register - Đăng ký tài khoản mới
    async register(req, res, next) {
        try {
            console.log("[AUTH CONTROLLER] Register request received:", req.query);
            const { email, password, displayName, photoURL } = req.query;
            const result = await authService.register({
                email,
                password,
                displayName,
                photoURL,
            });
            console.log("[AUTH CONTROLLER] ✅ Register successful:", result);
            return response_1.ResponseUtil.created(res, result, result.message);
        }
        catch (error) {
            console.error("[AUTH CONTROLLER] ❌ Register error:", error);
            next(error);
        }
    }
    // POST /api/auth/login - Đăng nhập
    async login(req, res, next) {
        try {
            const { email, password } = req.query;
            const result = await authService.login({ email, password });
            return response_1.ResponseUtil.success(res, result, "Login successful");
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/auth/refresh - Làm mới access token
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.query;
            const result = await authService.refreshToken(refreshToken);
            return response_1.ResponseUtil.success(res, result, "Token refreshed successfully");
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/auth/profile - Lấy thông tin user hiện tại
    async getProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const user = await authService.getProfile(userId);
            return response_1.ResponseUtil.success(res, user);
        }
        catch (error) {
            next(error);
        }
    }
    // PATCH /api/auth/profile - Cập nhật thông tin user
    async updateProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const { displayName, photoURL, pushToken } = req.query;
            const user = await authService.updateProfile(userId, {
                displayName,
                photoURL,
                pushToken,
            });
            return response_1.ResponseUtil.success(res, user, "Profile updated successfully");
        }
        catch (error) {
            next(error);
        }
    }
    // DELETE /api/auth/account - Xóa tài khoản
    async deleteAccount(req, res, next) {
        try {
            const userId = req.user.id;
            await authService.deleteAccount(userId);
            return response_1.ResponseUtil.success(res, null, "Account deleted successfully");
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/auth/logout - Đăng xuất (client-side xóa token)
    async logout(req, res, next) {
        try {
            // Với JWT, logout chủ yếu xử lý ở client (xóa token)
            // Hoặc có thể implement blacklist token ở đây nếu cần
            return response_1.ResponseUtil.success(res, null, "Logout successful");
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/auth/verify-email - Xác thực email với mã
    async verifyEmail(req, res, next) {
        try {
            const { email, code } = req.query;
            const result = await authService.verifyEmail({ email, code });
            return response_1.ResponseUtil.success(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/auth/resend-verification - Gửi lại mã xác thực
    async resendVerification(req, res, next) {
        try {
            const { email } = req.query;
            const result = await authService.resendVerificationCode({ email });
            return response_1.ResponseUtil.success(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/auth/google - Chuyển hướng đến Google OAuth
    async googleLogin(req, res, next) {
        try {
            const authUrl = await authService.getGoogleAuthUrl();
            return res.redirect(authUrl);
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/auth/google/callback - Xử lý callback từ Google
    async googleCallback(req, res, next) {
        try {
            const { code } = req.query;
            if (!code) {
                return response_1.ResponseUtil.error(res, "Authorization code is required", 400);
            }
            const result = await authService.googleAuth(code);
            return response_1.ResponseUtil.success(res, result, result.isNewUser ? "Account created successfully" : "Login successful");
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/auth/forgot-password - Request password reset
    async forgotPassword(req, res, next) {
        try {
            const data = req.body;
            const result = await authService.requestPasswordReset(data);
            return response_1.ResponseUtil.success(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/auth/reset-password - Reset password with token
    async resetPassword(req, res, next) {
        try {
            const data = req.body;
            const result = await authService.resetPassword(data);
            return response_1.ResponseUtil.success(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map