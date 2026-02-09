# User Profile API Documentation

## Overview

API Profile đã được cập nhật để hỗ trợ hệ thống người dùng đại chúng thay vì chỉ sinh viên. Schema mới bao gồm các trường Trust & Reputation, thông tin cá nhân mở rộng, và cài đặt riêng tư.

## Database Schema Changes

### User Model (Updated)

| Field             | Type                     | Description                                             |
| ----------------- | ------------------------ | ------------------------------------------------------- |
| `memberId`        | String (unique)          | Định danh người dùng toàn hệ thống (format: `USER_xxx`) |
| `trustScore`      | Float (default: 5.0)     | Mức độ uy tín khi trả đồ (0-5)                          |
| `totalReturned`   | Int (default: 0)         | Số đồ đã trả                                            |
| `itemsLost`       | Int (default: 0)         | Số đồ bị mất                                            |
| `addressCity`     | String (nullable)        | Địa chỉ thành phố                                       |
| `bio`             | String (nullable)        | Tiểu sử cá nhân                                         |
| `isVerified`      | Boolean (default: false) | Đánh dấu tài khoản đã xác minh                          |
| `privacySettings` | JSON                     | Cài đặt riêng tư (e.g., ẩn/hiện số điện thoại)          |

---

## API Endpoints

### 1. GET /api/auth/profile

**Description:** Lấy thông tin profile của người dùng hiện tại.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "member_id": "USER_79NV...",
    "full_name": "Lê Anh Tú",
    "email": "leanhtu1123@gmail.com",
    "phone": "0398624656",
    "avatar_url": "https://cloudinary.com/...",
    "is_verified": true,
    "stats": {
      "trust_score": 4.9,
      "items_lost": 2,
      "items_returned": 5
    },
    "address": "Quận Hà Đông, Hà Nội",
    "bio": "Sinh viên PTIT yêu công nghệ",
    "stream_token": "eyJ0eXAiOiJKV1QiLCJhbGciO...",
    "privacy_settings": {
      "showPhone": true,
      "showEmail": false
    },
    "created_at": "2026-01-15T10:30:00.000Z"
  }
}
```

**Response (Error - 401):**

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

### 2. PATCH /api/auth/profile

**Description:** Cập nhật thông tin profile của người dùng.

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "displayName": "Lê Anh Tú Updated",
  "phoneNumber": "0398624656",
  "photoURL": "https://cloudinary.com/new-avatar.jpg",
  "bio": "Làm việc tại Google Vietnam",
  "addressCity": "Quận 1, TP.HCM",
  "privacySettings": {
    "showPhone": false,
    "showEmail": true
  }
}
```

**Field Validation:**

| Field             | Type   | Validation                                            |
| ----------------- | ------ | ----------------------------------------------------- |
| `displayName`     | string | Min 2, max 50 characters, letters/numbers/spaces only |
| `phoneNumber`     | string | 10-11 digits                                          |
| `photoURL`        | string | Valid URL (optional)                                  |
| `bio`             | string | Max 500 characters                                    |
| `addressCity`     | string | Max 100 characters                                    |
| `privacySettings` | object | `{showPhone?: boolean, showEmail?: boolean}`          |

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "member_id": "USER_79NV...",
    "full_name": "Lê Anh Tú Updated",
    "email": "leanhtu1123@gmail.com",
    "phone": "0398624656",
    "avatar_url": "https://cloudinary.com/new-avatar.jpg",
    "is_verified": true,
    "stats": {
      "trust_score": 4.9,
      "items_lost": 2,
      "items_returned": 5
    },
    "address": "Quận 1, TP.HCM",
    "bio": "Làm việc tại Google Vietnam",
    "stream_token": "eyJ0eXAiOiJKV1QiLCJhbGciO...",
    "privacy_settings": {
      "showPhone": false,
      "showEmail": true
    },
    "created_at": "2026-01-15T10:30:00.000Z"
  },
  "message": "Profile updated successfully"
}
```

**Response (Error - 400 Validation):**

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "displayName",
      "message": "Display name must be at least 2 characters"
    }
  ]
}
```

---

## Stream Chat Integration

API Profile tự động trả về `stream_token` dựa trên `member_id` của người dùng. Token này được sử dụng để:

1. **Authenticate với Stream Chat SDK** trên frontend
2. **Tạo và tham gia các channel chat** giữa người tìm đồ và chủ sở hữu
3. **Nhận real-time notifications** về tin nhắn mới

### Usage in Frontend (React Native / Web):

```javascript
import { StreamChat } from "stream-chat";

// Initialize client
const chatClient = StreamChat.getInstance(STREAM_API_KEY);

// Connect user with token from profile API
await chatClient.connectUser(
  {
    id: profileData.member_id,
    name: profileData.full_name,
    image: profileData.avatar_url,
  },
  profileData.stream_token
);
```

---

## Security Notes

1. **Auth Middleware:** Tất cả các endpoint profile đều yêu cầu JWT Access Token hợp lệ
2. **Owner-only Access:** Người dùng chỉ có thể xem và sửa profile của chính họ
3. **Privacy Settings:** Frontend nên tôn trọng `privacy_settings` khi hiển thị thông tin cho người khác

---

## Migration Notes

Nếu bạn đang upgrade từ version cũ, cần chạy:

```bash
# Generate Prisma Client mới
npx prisma generate

# Đồng bộ schema với database
npx prisma migrate dev --name add_user_profile_fields
# hoặc
npx prisma db push
```

Các user cũ sẽ có:

- `memberId`: Auto-generated dựa trên `uid`
- `trustScore`: Default 5.0
- `itemsLost`: Default 0
- `privacySettings`: Default `{}`
