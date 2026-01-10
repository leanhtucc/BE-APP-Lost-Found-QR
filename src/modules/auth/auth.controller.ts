import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { ResponseUtil } from "../../utils/response";

/**
 * Auth Controller
 * Handle authentication HTTP requests
 */

const authService = new AuthService();

export class AuthController {
  // POST /api/auth/register - Đăng ký tài khoản mới
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, displayName, photoURL } = req.body;

      const result = await authService.register({
        email,
        password,
        displayName,
        photoURL,
      });

      return ResponseUtil.created(res, result, "Registration successful");
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/login - Đăng nhập
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const result = await authService.login({ email, password });

      return ResponseUtil.success(res, result, "Login successful");
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/refresh - Làm mới access token
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      const result = await authService.refreshToken(refreshToken);

      return ResponseUtil.success(res, result, "Token refreshed successfully");
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/profile - Lấy thông tin user hiện tại
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const user = await authService.getProfile(userId);

      return ResponseUtil.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/auth/profile - Cập nhật thông tin user
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { displayName, photoURL, pushToken } = req.body;

      const user = await authService.updateProfile(userId, {
        displayName,
        photoURL,
        pushToken,
      });

      return ResponseUtil.success(res, user, "Profile updated successfully");
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/auth/account - Xóa tài khoản
  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      await authService.deleteAccount(userId);

      return ResponseUtil.success(res, null, "Account deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/logout - Đăng xuất (client-side xóa token)
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Với JWT, logout chủ yếu xử lý ở client (xóa token)
      // Hoặc có thể implement blacklist token ở đây nếu cần
      return ResponseUtil.success(res, null, "Logout successful");
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/verify-email - Xác thực email với mã
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code } = req.body;

      const result = await authService.verifyEmail({ email, code });

      return ResponseUtil.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/resend-verification - Gửi lại mã xác thực
  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      const result = await authService.resendVerificationCode({ email });

      return ResponseUtil.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}
