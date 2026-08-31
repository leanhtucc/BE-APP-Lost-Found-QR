# Profile API

Base URL: `/api/auth`. Tất cả endpoint yêu cầu `Authorization: Bearer <access_token>`.

Response dùng envelope chung:

```json
{
  "success": true,
  "message": "Profile loaded successfully",
  "data": {},
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

## Profile

### `GET /api/auth/profile`

Trả hồ sơ, trust score chuẩn hóa `0..100`, thống kê tổng hợp trực tiếp từ database và preferences. Response không chứa password hash, OTP, refresh token hoặc push token.

```json
{
  "id": "user-id",
  "memberId": "USER_abc123",
  "email": "user@example.com",
  "displayName": "Nguyễn Văn An",
  "photoURL": "https://cdn.example.com/avatar.jpg",
  "phoneNumber": "+84912345678",
  "address": "Quận 1, TP.HCM",
  "bio": "Sinh viên PTIT",
  "authProvider": "password",
  "emailVerified": true,
  "createdAt": "2025-10-20T09:00:00.000Z",
  "updatedAt": "2026-08-31T09:00:00.000Z",
  "trust": {
    "score": 75,
    "level": "GOLD",
    "isVerified": false,
    "completedReturns": 4
  },
  "stats": {
    "protectedItems": 12,
    "safeItems": 10,
    "lostItems": 2,
    "activeLostReports": 1,
    "completedReturns": 4,
    "qrScans": 8
  },
  "preferences": {
    "pushEnabled": true,
    "emailEnabled": false,
    "proximityEnabled": true,
    "notificationRadiusMeters": 3000,
    "language": "vi"
  }
}
```

Các alias cũ (`member_id`, `full_name`, `avatar_url`, `stream_token`, ...) vẫn được giữ. Object `stats` cũng giữ các key cũ `trust_score`, `items_lost`, `items_returned` để không phá mobile client cũ.

### `GET /api/auth/profile/stats`

Trả riêng sáu field thống kê trên. Các con số không phụ thuộc pagination của `/api/items`.

### `PATCH /api/auth/profile`

Partial update. Field không gửi được giữ nguyên; `photoURL`, `phoneNumber`, `address`, `bio` nhận `null` để xóa.

| Field | Validation |
| --- | --- |
| `displayName` | 2–50 ký tự, trim |
| `photoURL` | HTTPS URL hoặc `null` |
| `phoneNumber` | 8–15 chữ số, có thể bắt đầu bằng `+`, hoặc `null` |
| `address` | tối đa 255 ký tự hoặc `null` |
| `bio` | tối đa 300 ký tự hoặc `null` |

`pushToken` vẫn được chấp nhận tạm thời cho client cũ. Client mới phải dùng device API.

## Notification preferences

### `GET /api/auth/profile/preferences`

Nếu user chưa có record, server tạo defaults: push `true`, email `false`, proximity `true`, radius `3000`, language `vi`.

### `PATCH /api/auth/profile/preferences`

```json
{
  "pushEnabled": false,
  "emailEnabled": true,
  "proximityEnabled": true,
  "notificationRadiusMeters": 1000,
  "language": "vi"
}
```

Radius phải là integer `100..5000`; language chỉ nhận `vi` hoặc `en`. API cũ `/v1/notifications/preferences` vẫn hoạt động.

## Devices

### `POST /api/auth/devices`

Upsert theo `(userId, deviceId)`. `pushToken` là unique toàn hệ thống.

```json
{
  "deviceId": "android-8c733127",
  "platform": "android",
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxx]",
  "appVersion": "1.0.0"
}
```

### `DELETE /api/auth/devices/:deviceId`

Chỉ xóa device của user hiện tại. Token lỗi từ FCM (`registration-token-not-registered` hoặc `invalid-registration-token`) được tự động disable.

## Password and account deletion

### `POST /api/auth/change-password`

Body gồm `currentPassword`, `newPassword`. Password mới tối thiểu 8 ký tự, có chữ hoa, chữ thường và số. Social account nhận `PASSWORD_NOT_SUPPORTED_FOR_PROVIDER`. Thành công revoke các JWT đã phát hành và yêu cầu đăng nhập lại.

### `POST /api/auth/account/deletion-otp`

Gửi OTP dùng một lần, hết hạn sau 600 giây.

### `DELETE /api/auth/account`

```json
{
  "otpCode": "123456",
  "confirmation": "DELETE"
}
```

Thành công sẽ lên lịch xóa sau 30 ngày, revoke session, tắt devices/preferences và vô hiệu hóa QR. Dữ liệu được soft-delete trong giai đoạn khôi phục; job chạy hằng ngày sẽ ẩn danh PII khi hết hạn nhưng giữ các bản ghi giao dịch bắt buộc.

## Error codes

Các code chính: `VALIDATION_ERROR`, `UNAUTHORIZED`, `REAUTHENTICATION_REQUIRED`, `PASSWORD_NOT_SUPPORTED_FOR_PROVIDER`, `PROFILE_NOT_FOUND`, `PHONE_ALREADY_USED`, `INVALID_NOTIFICATION_RADIUS`, `RATE_LIMITED`, `INTERNAL_ERROR`.
