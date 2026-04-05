import { NextFunction, Request, Response } from "express";
import { ResponseUtil } from "../../utils/response";
import { AuthService } from "./auth.service";

/**
 * Auth Controller
 * Handle authentication HTTP requests
 */

const authService = new AuthService();

export class AuthController {
  // POST /api/auth/register - Đăng ký tài khoản mới
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      console.log("[AUTH CONTROLLER] Register request received:", req.body);

      const { email, password, displayName, photoURL, phoneNumber } =
        req.body as any;

      const result = await authService.register({
        email,
        password,
        displayName,
        photoURL,
        phoneNumber,
      });

      console.log("[AUTH CONTROLLER] ✅ Register successful:", result);
      return ResponseUtil.created(res, result, result.message);
    } catch (error) {
      console.error("[AUTH CONTROLLER] ❌ Register error:", error);
      next(error);
    }
  }

  // POST /api/auth/login - Đăng nhập
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as any;

      const result = await authService.login({ email, password });

      return ResponseUtil.success(res, result, "Login successful");
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/refresh - Làm mới access token
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body as any;

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
      const {
        displayName,
        photoURL,
        pushToken,
        phoneNumber,
        bio,
        addressCity,
        privacySettings,
      } = req.body as any;

      const user = await authService.updateProfile(userId, {
        displayName,
        photoURL,
        pushToken,
        phoneNumber,
        bio,
        addressCity,
        privacySettings,
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
      const { email, code } = req.body as any;

      const result = await authService.verifyEmail({ email, code });

      return ResponseUtil.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/resend-verification - Gửi lại mã xác thực
  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body as any;

      const result = await authService.resendVerificationCode({ email });

      return ResponseUtil.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/google - Chuyển hướng đến Google OAuth
  async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const authUrl = await authService.getGoogleAuthUrl();
      return res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/google/callback - Xử lý callback từ Google (Web flow)
  async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.query as any;

      if (!code) {
        return ResponseUtil.error(res, "Authorization code is required", 400);
      }

      const result = await authService.googleAuth(code);

      return ResponseUtil.success(
        res,
        result,
        result.isNewUser ? "Account created successfully" : "Login successful"
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/google - Đăng nhập bằng Google ID Token (Mobile flow)
  async googleAuthWithIdToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = req.body as any;

      if (!idToken) {
        return ResponseUtil.error(res, "Google ID token is required", 400);
      }

      const result = await authService.googleAuthWithIdToken(idToken);

      return ResponseUtil.success(
        res,
        result,
        result.isNewUser
          ? "Account created successfully via Google"
          : "Login successful via Google"
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/firebase-verify - Đăng nhập bằng Firebase ID Token (Mobile flow)
  async firebaseVerify(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = req.body as any;

      if (!idToken) {
        return ResponseUtil.error(res, "Firebase ID token is required", 400);
      }

      const result = await authService.verifyFirebaseToken(idToken);

      return ResponseUtil.success(
        res,
        result,
        result.isNewUser
          ? "Account created successfully via Firebase"
          : "Login successful via Firebase"
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/forgot-password - Request password reset
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.requestPasswordReset(data);
      return ResponseUtil.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/reset-password - Reset password with token
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const result = await authService.resetPassword(data);
      return ResponseUtil.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}
