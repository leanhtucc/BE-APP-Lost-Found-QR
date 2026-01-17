import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { AuthController } from "./auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "./auth.schema";

/**
 * Auth Routes
 */

const router = Router();
const authController = new AuthController();

// Public routes
router.post("/register", validate(registerSchema), authController.register);

router.post("/login", validate(loginSchema), authController.login);

router.post(
  "/refresh",
  validate(refreshTokenSchema),
  authController.refreshToken
);

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  authController.verifyEmail
);

router.post(
  "/resend-verification",
  validate(resendVerificationSchema),
  authController.resendVerification
);

// Google OAuth routes
router.get("/google", authController.googleLogin);

router.get("/google/callback", authController.googleCallback);

// Password reset routes
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword
);

// Protected routes (cần authentication)
router.get("/profile", authMiddleware, authController.getProfile);

router.patch(
  "/profile",
  authMiddleware,
  validate(updateProfileSchema),
  authController.updateProfile
);

router.delete("/account", authMiddleware, authController.deleteAccount);

router.post("/logout", authMiddleware, authController.logout);

export default router;
