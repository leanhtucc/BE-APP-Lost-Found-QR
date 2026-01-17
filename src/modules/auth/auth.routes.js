"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const auth_controller_1 = require("./auth.controller");
const auth_schema_1 = require("./auth.schema");
/**
 * Auth Routes
 */
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
// Public routes
router.post("/register", (0, validate_middleware_1.validate)(auth_schema_1.registerSchema), authController.register);
router.post("/login", (0, validate_middleware_1.validate)(auth_schema_1.loginSchema), authController.login);
router.post("/refresh", (0, validate_middleware_1.validate)(auth_schema_1.refreshTokenSchema), authController.refreshToken);
router.post("/verify-email", (0, validate_middleware_1.validate)(auth_schema_1.verifyEmailSchema), authController.verifyEmail);
router.post("/resend-verification", (0, validate_middleware_1.validate)(auth_schema_1.resendVerificationSchema), authController.resendVerification);
// Google OAuth routes
router.get("/google", authController.googleLogin);
router.get("/google/callback", authController.googleCallback);
// Password reset routes
router.post("/forgot-password", (0, validate_middleware_1.validate)(auth_schema_1.forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", (0, validate_middleware_1.validate)(auth_schema_1.resetPasswordSchema), authController.resetPassword);
// Protected routes (cần authentication)
router.get("/profile", auth_middleware_1.authMiddleware, authController.getProfile);
router.patch("/profile", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(auth_schema_1.updateProfileSchema), authController.updateProfile);
router.delete("/account", auth_middleware_1.authMiddleware, authController.deleteAccount);
router.post("/logout", auth_middleware_1.authMiddleware, authController.logout);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map