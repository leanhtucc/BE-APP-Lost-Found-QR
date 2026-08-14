# 🔐 Auth API Examples

## ⚠️ Flow Đăng ký mới (Updated)

**Bước 1: Đăng ký tài khoản**

```bash
POST http://localhost:3000/api/auth/register
```

**Bước 2: Nhận mã code qua email (kiểm tra hộp thư)**

**Bước 3: Xác thực email với mã code**

```bash
POST http://localhost:3000/api/auth/verify-otp
```

**Bước 4: Nhận token và có thể login**

---

## 🔵 Đăng nhập bằng Google

### Flow cho Mobile App (React Native / Expo)

**Sử dụng thư viện:** `expo-auth-session` hoặc `@react-native-google-signin/google-signin`

**Endpoint:**

```bash
POST http://localhost:3000/api/auth/google
Content-Type: application/json

{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6..."
}
```

**Response (Success - Account mới):**

```json
{
  "success": true,
  "message": "Account created successfully via Google",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "clx1234567890",
      "uid": "user_abc123xyz",
      "email": "user@gmail.com",
      "displayName": "John Doe",
      "photoURL": "https://lh3.googleusercontent.com/...",
      "phoneNumber": null,
      "totalReturned": 0,
      "createdAt": "2026-01-10T10:00:00.000Z"
    },
    "isNewUser": true
  }
}
```

**Response (Success - Account đã tồn tại):**

```json
{
  "success": true,
  "message": "Login successful via Google",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "clx1234567890",
      "uid": "user_abc123xyz",
      "email": "user@gmail.com",
      "displayName": "John Doe",
      "photoURL": "https://lh3.googleusercontent.com/...",
      "phoneNumber": "0912345678",
      "totalReturned": 5,
      "createdAt": "2026-01-10T10:00:00.000Z"
    },
    "isNewUser": false
  }
}
```

### Ví dụ code React Native với expo-auth-session

```typescript
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  clientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
  iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
  androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
});

const handleGoogleSignIn = async () => {
  const result = await promptAsync();

  if (result.type === "success") {
    const { id_token } = result.params;

    // Gửi ID Token lên server
    const response = await fetch("http://localhost:3000/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: id_token }),
    });

    const data = await response.json();
    // Lưu token và thông tin user
  }
};
```

### Flow cho Web Browser

**Bước 1: Chuyển hướng đến Google**

```bash
GET http://localhost:3000/api/auth/google
```

Browser sẽ được redirect đến trang đăng nhập Google.

**Bước 2: Google redirect về callback**

```bash
GET http://localhost:3000/api/auth/google/callback?code=...
```

**Response:** Giống với Mobile flow ở trên.

### Lưu ý quan trọng

1. **User tự động được verify** khi đăng nhập bằng Google
2. **Nếu email đã exists:** Google account sẽ được link vào account hiện tại
3. **Welcome email** được gửi cho user mới
4. **Không cần password** cho Google users

## 1. Đăng ký tài khoản và gửi OTP

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "full_name": "Nguyen Van An",
  "email": "user@example.com",
  "password": "Password123",
  "password_confirmation": "Password123"
}
```

Không cần `phoneNumber`. Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa,
chữ thường và chữ số. `password_confirmation` phải giống `password`.

Response thành công chưa có token vì tài khoản chỉ được tạo sau khi xác nhận OTP:

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

## 2. Xác nhận OTP và hoàn tất đăng ký

```http
POST http://localhost:3000/api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

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

## 3. Gửi lại OTP

```http
POST http://localhost:3000/api/auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

OTP có hiệu lực 15 phút và API gửi lại có cooldown 60 giây.

---

## 4. Đăng nhập

**⚠️ Chỉ dành cho user đã verify email!**

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (Chỉ có token):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**💡 Để lấy thông tin user:**

```bash
GET http://localhost:3000/api/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 5. Làm mới access token

```bash
POST http://localhost:3000/api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (Chỉ có token):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 6. Lấy thông tin profile

**🔑 Sử dụng token từ login để lấy user data**

```bash
GET http://localhost:3000/api/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "clx1234567890",
    "uid": "user_abc123xyz",
    "email": "user@example.com",
    "displayName": "John Doe",
    "photoURL": "https://example.com/avatar.jpg",
    "phoneNumber": "0912345678",
    "totalReturned": 0,
    "createdAt": "2026-01-10T10:00:00.000Z"
  }
}
```

---

## 7. Cập nhật profile

```bash
PATCH http://localhost:3000/api/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "displayName": "Jane Doe",
  "photoURL": "https://example.com/new-avatar.jpg",
  "phoneNumber": "0987654321",
  "pushToken": "fcm-token-123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "clx1234567890",
    "uid": "user_abc123xyz",
    "email": "user@example.com",
    "displayName": "Jane Doe",
    "photoURL": "https://example.com/new-avatar.jpg",
    "phoneNumber": "0987654321",
    "totalReturned": 0,
    "createdAt": "2026-01-10T10:00:00.000Z"
  }
}
```

---

## 8. Đăng xuất

```bash
POST http://localhost:3000/api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**

```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

> **Note**: Với JWT, logout chủ yếu xử lý ở client-side bằng cách xóa token. Server chỉ trả về success response.

---

## 9. Xóa tài khoản

```bash
DELETE http://localhost:3000/api/auth/account
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "data": null
}
```

---

## Error Responses

### Email chưa verify (403) - Khi login

```json
{
  "success": false,
  "message": "Please verify your email before logging in. Check your inbox for the verification code.",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Mã xác thực hết hạn (400)

```json
{
  "success": false,
  "message": "Verification code expired. Please request a new code.",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Mã xác thực sai (400)

```json
{
  "success": false,
  "message": "Invalid verification code",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Validation Error - Password yếu (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Validation Error - Display name không hợp lệ (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Display name can only contain letters, numbers, and spaces",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Validation Error - Email format (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Invalid email format",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Email đã tồn tại (400)

```json
{
  "success": false,
  "message": "Email already registered",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Sai email/password (401)

```json
{
  "success": false,
  "message": "Invalid email or password",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Token không hợp lệ (401)

```json
{
  "success": false,
  "message": "Invalid token",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Password must be at least 6 characters",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```
