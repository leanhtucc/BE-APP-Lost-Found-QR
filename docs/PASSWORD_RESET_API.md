# 🔐 Password Reset API Documentation

Complete guide for implementing Forgot Password functionality in Lost & Found application.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Flow Diagram](#flow-diagram)
- [API Endpoints](#api-endpoints)
- [Testing Examples](#testing-examples)
- [Email Template](#email-template)
- [Frontend Integration](#frontend-integration)
- [Security Features](#security-features)

---

## 🎯 Overview

The Password Reset feature allows users to reset their password when they forget it. The flow is:

1. **User requests password reset** → Enters email
2. **Backend sends email** → With reset link containing unique token
3. **User clicks link** → Opens reset password page
4. **User enters new password** → Password is updated

### Key Features

✅ **Secure token generation** - 64-character random string
✅ **Time-limited tokens** - 30 minutes expiry
✅ **One-time use** - Token deleted after password reset
✅ **Email obfuscation** - Don't reveal if email exists (security)
✅ **Password validation** - Must contain uppercase, lowercase, and number

---

## 🔄 Flow Diagram

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ 1. Forgot Password
       ▼
┌─────────────────────────────────┐
│  POST /api/auth/forgot-password │
│  Body: { email }                │
└──────────────┬──────────────────┘
               │ 2. Generate token & send email
               ▼
┌────────────────────────────────┐
│  Email with reset link sent    │
│  Link: /reset-password?token=  │
└──────────────┬─────────────────┘
               │ 3. User clicks link
               ▼
┌────────────────────────────────┐
│  Frontend: Reset Password Page │
│  Input: New Password           │
└──────────────┬─────────────────┘
               │ 4. Submit new password
               ▼
┌─────────────────────────────────┐
│  POST /api/auth/reset-password  │
│  Body: { token, newPassword }   │
└──────────────┬──────────────────┘
               │ 5. Password updated
               ▼
┌────────────────────────────────┐
│  Success! User can login       │
└────────────────────────────────┘
```

---

## 📡 API Endpoints

### 1. Request Password Reset

**Endpoint:** `POST /api/auth/forgot-password`

**Description:** Sends a password reset email with a unique token

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent.",
  "data": {
    "message": "If an account with that email exists, a password reset link has been sent."
  }
}
```

**Notes:**

- ✅ Always returns same message (security - don't reveal if email exists)
- ✅ Token is 64 characters long
- ✅ Token expires in 30 minutes
- ✅ Email sent to user with reset link

**Error Response (500):**

```json
{
  "success": false,
  "message": "Failed to send password reset email. Please try again."
}
```

---

### 2. Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Description:** Resets user password using the token from email

**Request Body:**

```json
{
  "token": "abc123...64-char-token...",
  "newPassword": "NewPassword123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now login.",
  "data": {
    "message": "Password has been reset successfully. You can now login."
  }
}
```

**Error Responses:**

**Invalid/Expired Token (400):**

```json
{
  "success": false,
  "message": "Invalid or expired reset token. Please request a new password reset."
}
```

**Token Expired (400):**

```json
{
  "success": false,
  "message": "Reset token has expired. Please request a new password reset."
}
```

**Validation Error (400):**

```json
{
  "success": false,
  "message": "Password must contain at least one uppercase letter, one lowercase letter, and one number"
}
```

---

## 🧪 Testing Examples

### Test 1: Request Password Reset

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent.",
  "data": {
    "message": "If an account with that email exists, a password reset link has been sent."
  }
}
```

**Check email** for reset link (if SMTP configured)

---

### Test 2: Reset Password with Token

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_FROM_EMAIL_HERE",
    "newPassword": "NewPassword123"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now login.",
  "data": {
    "message": "Password has been reset successfully. You can now login."
  }
}
```

---

### Test 3: Verify New Password Works

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "NewPassword123"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 📧 Email Template

The password reset email includes:

- **Subject:** "Đặt lại mật khẩu - Lost & Found"
- **Reset Link:** `${FRONTEND_URL}/reset-password?token=${resetToken}`
- **Expiry Warning:** Link valid for 30 minutes
- **Security Note:** One-time use only

**Email Preview:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 Đặt lại mật khẩu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Xin chào [User Name],

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.

┌─────────────────────────────────┐
│   [ Đặt lại mật khẩu ]          │
└─────────────────────────────────┘

Hoặc sao chép link sau vào trình duyệt:
http://localhost:19006/reset-password?token=...

⚠️ Lưu ý:
- Link này chỉ có hiệu lực trong 30 phút
- Chỉ sử dụng được 1 lần
- Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này

Trân trọng,
Lost & Found Team
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎨 Frontend Integration

### React Native Example

```typescript
// Step 1: Forgot Password Screen
const forgotPassword = async (email: string) => {
  try {
    const response = await fetch(
      "http://localhost:3000/api/auth/forgot-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );

    const data = await response.json();

    if (data.success) {
      Alert.alert(
        "Email Sent",
        "Check your email for password reset instructions"
      );
    }
  } catch (error) {
    Alert.alert("Error", "Failed to send reset email");
  }
};

// Step 2: Reset Password Screen
const resetPassword = async (token: string, newPassword: string) => {
  try {
    const response = await fetch(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      }
    );

    const data = await response.json();

    if (data.success) {
      Alert.alert("Success", "Password reset successful! Please login.");
      navigation.navigate("Login");
    } else {
      Alert.alert("Error", data.message);
    }
  } catch (error) {
    Alert.alert("Error", "Failed to reset password");
  }
};
```

### Deep Link Handling (Expo)

```typescript
// app.json
{
  "expo": {
    "scheme": "lostfound",
    "web": {
      "bundler": "metro"
    }
  }
}

// App.tsx - Handle deep link
import * as Linking from "expo-linking";

useEffect(() => {
  const handleDeepLink = (event: { url: string }) => {
    const { path, queryParams } = Linking.parse(event.url);

    if (path === "reset-password" && queryParams?.token) {
      navigation.navigate("ResetPassword", {
        token: queryParams.token,
      });
    }
  };

  Linking.addEventListener("url", handleDeepLink);

  return () => {
    Linking.removeEventListener("url", handleDeepLink);
  };
}, []);
```

---

## 🔒 Security Features

### 1. Token Security

✅ **64-character random token** - Using `nanoid(64)`
✅ **30-minute expiry** - Limited time window
✅ **One-time use** - Token deleted after reset
✅ **Database indexed** - Fast token lookup

### 2. Email Obfuscation

❌ **Bad:** "Email not found" (reveals user existence)
✅ **Good:** "If account exists, email sent" (doesn't reveal)

### 3. Password Validation

✅ Minimum 6 characters
✅ At least 1 uppercase letter
✅ At least 1 lowercase letter
✅ At least 1 number

**Regex:** `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/`

### 4. Rate Limiting

Recommended: Add rate limiting to prevent abuse

```typescript
// In auth.routes.ts (add later)
import rateLimit from "express-rate-limit";

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: "Too many reset requests. Please try again later.",
});

router.post(
  "/forgot-password",
  resetLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
```

---

## 🗃️ Database Schema

**User Model (Prisma):**

```prisma
model User {
  id                     String    @id @default(cuid())
  email                  String    @unique
  password               String?
  resetPasswordToken     String?   // Reset token
  resetPasswordExpiry    DateTime? // Token expiry
  // ... other fields

  @@index([resetPasswordToken]) // For fast lookup
}
```

**Migration:**

```bash
npx prisma migrate dev --name add_password_reset_fields
```

---

## 🌍 Environment Variables

Add to `.env`:

```env
# Frontend URL (for reset links in email)
FRONTEND_URL=http://localhost:19006
```

**Production Example:**

```env
FRONTEND_URL=https://app.lostfound.com
```

---

## 📝 Summary

| Feature              | Implementation                 |
| -------------------- | ------------------------------ |
| Token Generation     | `nanoid(64)` - 64 chars        |
| Token Expiry         | 30 minutes                     |
| Token Usage          | One-time only                  |
| Email Service        | Nodemailer with HTML template  |
| Password Validation  | Uppercase + Lowercase + Number |
| Security             | Email obfuscation + Token hash |
| Database Fields      | `resetPasswordToken` + expiry  |
| Frontend Integration | Deep links + token param       |

---

## 🚀 Next Steps

1. ✅ **Test forgot password flow** - Use curl or Postman
2. ✅ **Configure SMTP** - Set up email service
3. ✅ **Test email delivery** - Verify email arrives
4. ✅ **Build frontend screens** - Forgot password + Reset password
5. ✅ **Add rate limiting** - Prevent abuse
6. ✅ **Deploy & test** - End-to-end testing

---

## 📞 Support

If you encounter issues:

1. Check SMTP configuration in `.env`
2. Verify `FRONTEND_URL` is correct
3. Test token expiry (30 minutes)
4. Check email spam folder
5. Review server logs for errors

---

**Created:** 2025-01-11
**Version:** 1.0.0
**Author:** Lost & Found Team

---
