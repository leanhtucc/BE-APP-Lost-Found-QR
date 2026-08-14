# Email registration and OTP verification

The email registration flow has two public steps. A phone number is not
required and is not used to identify a pending registration.

## 1. Send the registration OTP

```http
POST /api/auth/register
Content-Type: application/json

{
  "full_name": "Nguyen Van An",
  "email": "user@example.com",
  "password": "Password123",
  "password_confirmation": "Password123"
}
```

The API also accepts the camelCase aliases `fullName` and
`confirmPassword`. The existing `displayName` name alias remains accepted,
but every registration must include a matching password confirmation.

Successful response:

```json
{
  "success": true,
  "message": "OTP code has been sent to your email.",
  "data": {
    "email": "user@example.com",
    "otp_expires_in": 900
  },
  "timestamp": "2026-08-13T00:00:00.000Z"
}
```

## 2. Verify the OTP and create the account

```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

Successful response:

```json
{
  "status": 200,
  "success": true,
  "message": "OK",
  "data": {
    "access_token": "<jwt>",
    "expire_in": 86400,
    "refresh_token": "<jwt>",
    "refresh_token_expire_in": 2592000,
    "auth_type": "Bearer Token"
  }
}
```

The account is created only after the six-digit OTP is valid. An OTP expires
after 15 minutes and a pending registration is removed after five invalid
attempts.

## Resend the OTP

```http
POST /api/auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

The resend endpoint has a 60-second cooldown.

## SMTP

Configure these variables locally and in Render:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Lost & Found <your-account@gmail.com>"
SKIP_EMAIL_VERIFICATION=false
```

For Gmail, `SMTP_PASS` must be a Google App Password rather than the normal
account password.
