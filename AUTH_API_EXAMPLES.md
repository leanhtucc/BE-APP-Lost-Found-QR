# 🔐 Auth API Examples

## ⚠️ Flow Đăng ký mới (Updated)

**Bước 1: Đăng ký tài khoản**

```bash
POST http://localhost:3000/api/auth/register
```

**Bước 2: Nhận mã code qua email (kiểm tra hộp thư)**

**Bước 3: Xác thực email với mã code**

```bash
POST http://localhost:3000/api/auth/verify-email
```

**Bước 4: Nhận token và có thể login**

---

## 1. Đăng ký tài khoản (Bước 1)

```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123",
  "displayName": "John Doe",
  "photoURL": "https://example.com/avatar.jpg"
}
```

**Validation Rules:**

- ✅ **email**: Bắt buộc, phải đúng format email
- ✅ **password**:
  - Tối thiểu 8 ký tự
  - Phải có ít nhất 1 chữ HOA
  - Phải có ít nhất 1 chữ thường
  - Phải có ít nhất 1 số
- ✅ **displayName**:
  - Tối thiểu 2 ký tự, tối đa 50 ký tự
  - Chỉ chứa chữ cái, số, khoảng trắng (hỗ trợ tiếng Việt)
- ✅ **photoURL**: Optional, nếu có phải là URL hợp lệ

**Response (Không có token):**

```json
{
  "success": true,
  "message": "Registration successful! Please check your email for verification code.",
  "data": {
    "message": "Registration successful! Please check your email for verification code.",
    "email": "user@example.com"
  }
}
```

**⚠️ Lưu ý:**

- Không trả về token ngay
- User cần check email để lấy mã 6 chữ số
- Mã có hiệu lực 15 phút

---

## 2. Xác thực email (Bước 2)

```bash
POST http://localhost:3000/api/auth/verify-email
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response (Có token):**

```json
{
  "success": true,
  "message": "Email verified successfully! You can now use the app.",
  "data": {
    "message": "Email verified successfully! You can now use the app.",
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "clx1234567890",
      "uid": "user_abc123xyz",
      "email": "user@example.com",
      "displayName": "John Doe",
      "photoURL": "https://example.com/avatar.jpg",
      "totalReturned": 0,
      "createdAt": "2026-01-10T10:00:00.000Z"
    }
  }
}
```

**✅ Sau bước này:**

- User đã có token để sử dụng app
- Có thể gọi các API protected
- Welcome email được gửi tự động

---

## 3. Gửi lại mã xác thực

Nếu mã hết hạn hoặc không nhận được email:

```bash
POST http://localhost:3000/api/auth/resend-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Verification code sent successfully",
  "data": {
    "message": "Verification code sent successfully"
  }
}
```

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
