# 🔐 Password Reset API - Quick Test Guide

Quick reference for testing the Password Reset functionality.

---

## 🚀 Quick Test Flow

### Test 1: Request Password Reset

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Response:**

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

---

### Test 2: Check Email

Check your email inbox for password reset email with:

- Subject: "Đặt lại mật khẩu - Lost & Found"
- Reset link: `http://localhost:19006/reset-password?token=...`
- Copy the **token** from the URL

---

### Test 3: Reset Password with Token

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_YOUR_TOKEN_HERE",
    "newPassword": "NewPassword123"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now login."
}
```

---

### Test 4: Login with New Password

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "NewPassword123"
  }'
```

**Response:**

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

## 🧪 Postman Collection

### 1. Forgot Password

**Method:** `POST`
**URL:** `http://localhost:3000/api/auth/forgot-password`
**Headers:**

```
Content-Type: application/json
```

**Body (raw JSON):**

```json
{
  "email": "test@example.com"
}
```

---

### 2. Reset Password

**Method:** `POST`
**URL:** `http://localhost:3000/api/auth/reset-password`
**Headers:**

```
Content-Type: application/json
```

**Body (raw JSON):**

```json
{
  "token": "YOUR_TOKEN_FROM_EMAIL",
  "newPassword": "NewPassword123"
}
```

---

## ❌ Error Cases

### Invalid Token

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid_token",
    "newPassword": "NewPassword123"
  }'
```

**Response (400):**

```json
{
  "success": false,
  "message": "Invalid or expired reset token. Please request a new password reset."
}
```

---

### Weak Password

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "VALID_TOKEN",
    "newPassword": "weak"
  }'
```

**Response (400):**

```json
{
  "success": false,
  "message": "Password must contain at least one uppercase letter, one lowercase letter, and one number"
}
```

---

### Expired Token (After 30 minutes)

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "EXPIRED_TOKEN",
    "newPassword": "NewPassword123"
  }'
```

**Response (400):**

```json
{
  "success": false,
  "message": "Reset token has expired. Please request a new password reset."
}
```

---

## 📋 Checklist

Before testing, make sure:

- ✅ Server is running (`npm run dev`)
- ✅ Database is connected (PostgreSQL)
- ✅ Prisma migration applied (`npx prisma migrate dev`)
- ✅ SMTP is configured (or check logs for email content)
- ✅ FRONTEND_URL is set in `.env` (default: http://localhost:19006)
- ✅ User account exists (register first if needed)

---

## 🔑 Environment Variables

Required in `.env`:

```env
# Email SMTP (for sending reset emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@lostfound.com
SMTP_FROM_NAME=Lost & Found

# Frontend URL (for reset links)
FRONTEND_URL=http://localhost:19006
```

---

## 🐛 Troubleshooting

### Email not received?

1. Check SMTP configuration in `.env`
2. Check server logs for email errors
3. Check spam folder
4. If SMTP not configured, check logs for email content (dev mode)

### Token invalid?

1. Make sure token is complete (64 characters)
2. Check if token expired (30 minutes)
3. Token can only be used once
4. Request new reset if needed

### Password validation fails?

Password must have:

- ✅ At least 6 characters
- ✅ At least 1 uppercase letter (A-Z)
- ✅ At least 1 lowercase letter (a-z)
- ✅ At least 1 number (0-9)

**Valid examples:**

- `Password123`
- `MyPass456`
- `SecurePass1`

**Invalid examples:**

- `password` (no uppercase, no number)
- `PASSWORD123` (no lowercase)
- `MyPassword` (no number)
- `Pass1` (too short)

---

## 📊 Token Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│  1. User requests reset                                 │
│     → Token generated (64 chars)                        │
│     → Expiry set (now + 30 min)                         │
│     → Saved to database                                 │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  2. Email sent                                          │
│     → Link: /reset-password?token=...                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  3. User clicks link (within 30 min)                    │
│     → Validates token exists                            │
│     → Checks expiry time                                │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  4. Password reset                                      │
│     → Hash new password                                 │
│     → Update user password                              │
│     → Delete token + expiry (one-time use)              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  5. User can login with new password                    │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Notes

- Token is **64 characters** long (very secure)
- Token expires after **30 minutes**
- Token can be used **only once**
- Email doesn't reveal if account exists (security)
- Password must meet validation requirements
- Old password is replaced completely

---

## 🔗 Full Documentation

See [PASSWORD_RESET_API.md](PASSWORD_RESET_API.md) for complete documentation.

---

**Created:** 2025-01-11
**Version:** 1.0.0
