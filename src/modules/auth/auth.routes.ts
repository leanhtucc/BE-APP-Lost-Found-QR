import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { queryToBody } from "../../middlewares/query-to-body.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { AuthController } from "./auth.controller";
import {
  changePasswordSchema,
  confirmAccountDeletionSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyOtpSchema,
  resendOtpSchema,
  firebaseVerifySchema,
} from "./auth.schema";
import { rateLimit } from "../../middlewares/rate-limit.middleware";
import { notificationController } from "../notification/notification.controller";
import { updatePreferenceSchema } from "../notification/notification.schema";

/**
 * Auth Routes
 */

const router = Router();

// Per-IP limiters for unauthenticated endpoints (brute-force / abuse protection).
// Each call creates its own bucket; the app-wide limiter still applies on top.
const authLimiter = (max: number, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
  });

const authController = new AuthController();

// Public routes
router.post(
  "/register",
  authLimiter(10),
  queryToBody,
  validate(registerSchema),
  authController.register
);

router.post(
  "/login",
  authLimiter(10),
  queryToBody,
  validate(loginSchema),
  authController.login
);

router.post(
  "/refresh",
  authLimiter(60),
  queryToBody,
  validate(refreshTokenSchema),
  authController.refreshToken
);

router.post(
  "/verify-otp",
  authLimiter(10),
  queryToBody,
  validate(verifyOtpSchema),
  authController.verifyOtp
);

router.post(
  "/resend-otp",
  authLimiter(5),
  queryToBody,
  validate(resendOtpSchema),
  authController.resendOtp
);

// Google OAuth routes
// For web browser flow (redirect-based)
router.get("/google", authController.googleLogin);
router.get("/google/callback", authController.googleCallback);

// For mobile app flow (ID token-based)
router.post(
  "/google",
  authLimiter(20),
  validate(googleAuthSchema),
  authController.googleAuthWithIdToken
);

// For Firebase auth flow (mobile)
router.post(
  "/firebase-verify",
  authLimiter(20),
  validate(firebaseVerifySchema),
  authController.verifyFirebaseUser
);

// Password reset routes
router.post(
  "/forgot-password",
  authLimiter(5),
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  "/reset-password",
  authLimiter(10),
  validate(resetPasswordSchema),
  authController.resetPassword
);

// Protected routes (cần authentication)
router.get("/profile", authMiddleware, authController.getProfile);

router.get(
  "/profile/stats",
  authMiddleware,
  authController.getProfileStatistics
);

router.get(
  "/profile/preferences",
  authMiddleware,
  notificationController.getProfilePreferences
);

router.patch(
  "/profile/preferences",
  authMiddleware,
  validate(updatePreferenceSchema),
  notificationController.updateProfilePreferences
);

router.patch(
  "/profile",
  authMiddleware,
  validate(updateProfileSchema),
  authController.updateProfile
);

router.post(
  "/change-password",
  authMiddleware,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  validate(changePasswordSchema),
  authController.changePassword
);

router.post(
  "/account/deletion-otp",
  authMiddleware,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  authController.requestAccountDeletionOtp
);

router.delete(
  "/account",
  authMiddleware,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  validate(confirmAccountDeletionSchema),
  authController.deleteAccount
);

router.post("/logout", authMiddleware, authController.logout);

export default router;
