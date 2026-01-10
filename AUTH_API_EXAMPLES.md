# 🔐 Auth API Examples

## Đăng ký tài khoản

```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "John Doe",
  "photoURL": "https://example.com/avatar.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
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

---

## Đăng nhập

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
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

---

## Làm mới access token

```bash
POST http://localhost:3000/api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
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

---

## Lấy thông tin profile

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

## Cập nhật profile

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

## Đăng xuất

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

## Xóa tài khoản

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

### Email đã tồn tại (409)
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
