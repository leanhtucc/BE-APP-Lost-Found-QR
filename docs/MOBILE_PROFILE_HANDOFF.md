# Handoff cho App: Profile, Preferences, Devices và Account Security

Tài liệu này là contract triển khai cho team Mobile/App sau khi Backend cập nhật phần Profile. Mọi endpoint bên dưới dùng JSON và yêu cầu:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Base URL của nhóm Profile là `/api/auth`. Notification Center dùng contract chính `/v1/notifications`.

## 1. Thay đổi bắt buộc phía App

1. Màn Profile chỉ cần gọi `GET /api/auth/profile`.
2. Xóa cách tính số đồ bằng `GET /api/items` rồi lấy `items.length`; cách cũ sai khi danh sách có phân trang.
3. Không tự quy đổi trust score thành rating `3.8–5.0`. Hiển thị trực tiếp `trust.score`, `trust.level` từ Backend.
4. Màn sửa hồ sơ dùng các field camelCase mới: `displayName`, `photoURL`, `phoneNumber`, `address`, `bio`.
5. Notification settings đọc/ghi qua `/api/auth/profile/preferences`.
6. Push token mới phải đăng ký theo thiết bị qua `/api/auth/devices`, không tiếp tục dùng `PATCH /api/auth/profile` cho code mới.
7. Chỉ hiển thị “Đổi mật khẩu” khi `profile.authProvider === "password"`.
8. Xóa tài khoản là luồng hai bước: gửi OTP rồi xác nhận OTP.
9. Sau đổi mật khẩu hoặc xác nhận xóa tài khoản thành công, App phải xóa access/refresh token local và điều hướng về Login.
10. Notification Center tiếp tục dùng `/v1/notifications`; không dùng `/api/stream/notifications`.

## 2. Envelope response chung

Success:

```ts
export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string; // ISO 8601 UTC
}
```

Ví dụ:

```json
{
  "success": true,
  "message": "Profile loaded successfully",
  "data": {},
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

Error có code:

```ts
export interface ApiError {
  success: false;
  message: string;
  error?: {
    code?: string;
    fields?: Record<string, string>;
    detail?: string;
  };
  timestamp: string;
}
```

Không đọc error chỉ từ HTTP message. App nên ưu tiên `response.data.error.code`, sau đó mới fallback `response.data.message`.

## 3. TypeScript types đề xuất cho App

```ts
export type AuthProvider =
  | "password"
  | "google"
  | "firebase_phone"
  | "apple";

export type TrustLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export interface ProfileTrust {
  score: number; // integer 0..100
  level: TrustLevel;
  isVerified: boolean;
  completedReturns: number;
}

export interface ProfileStats {
  protectedItems: number;
  safeItems: number;
  lostItems: number;
  activeLostReports: number;
  completedReturns: number;
  qrScans: number;
}

export interface ProfilePreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  proximityEnabled: boolean;
  notificationRadiusMeters: number;
  language: "vi" | "en";
}

export interface UserProfile {
  id: string;
  memberId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  phoneNumber: string | null;
  address: string | null;
  bio: string | null;
  authProvider: AuthProvider;
  emailVerified: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  trust: ProfileTrust;
  stats: ProfileStats & {
    // Chỉ để tương thích client cũ; UI mới không nên dùng.
    trust_score?: number;
    items_lost?: number;
    items_returned?: number;
  };
  preferences: ProfilePreferences;

  // Legacy aliases còn được Backend trả trong giai đoạn chuyển đổi.
  member_id?: string;
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  stream_token?: string;
  privacy_settings?: Record<string, boolean>;
  created_at?: string;
}
```

App mới phải ưu tiên camelCase. Các alias snake_case chỉ dùng để rollout không gián đoạn và có thể bị loại bỏ ở phiên bản API tương lai.

## 4. GET `/api/auth/profile`

### Mục đích

Nguồn dữ liệu duy nhất cho màn Profile chính. Response đã gồm:

- Hồ sơ cá nhân.
- Trust score và level.
- Toàn bộ thống kê, không phụ thuộc pagination.
- Preferences cơ bản.
- `authProvider` để quyết định UI bảo mật.

### Response mẫu

```json
{
  "success": true,
  "message": "Profile loaded successfully",
  "data": {
    "id": "cm123-user-id",
    "memberId": "USER_abc123",
    "email": "user@example.com",
    "displayName": "Nguyễn Văn An",
    "photoURL": "https://cdn.example.com/avatar.jpg",
    "phoneNumber": "+84912345678",
    "address": "Quận 1, TP.HCM",
    "bio": "Tôi thường hoạt động tại khu vực Quận 1",
    "authProvider": "password",
    "emailVerified": true,
    "isVerified": true,
    "trustScore": 75,
    "totalReturned": 4,
    "itemsLost": 2,
    "createdAt": "2025-10-20T09:00:00.000Z",
    "updatedAt": "2026-08-31T09:00:00.000Z",
    "trust": {
      "score": 75,
      "level": "GOLD",
      "isVerified": true,
      "completedReturns": 4
    },
    "stats": {
      "protectedItems": 12,
      "safeItems": 10,
      "lostItems": 2,
      "activeLostReports": 1,
      "completedReturns": 4,
      "qrScans": 8,
      "trust_score": 75,
      "items_lost": 2,
      "items_returned": 4
    },
    "preferences": {
      "pushEnabled": true,
      "emailEnabled": false,
      "proximityEnabled": true,
      "notificationRadiusMeters": 3000,
      "language": "vi"
    }
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

### Cách render UI Profile

| Vị trí UI | Field mới |
| --- | --- |
| Avatar | `photoURL`; null thì dùng avatar placeholder |
| Tên | `displayName` |
| Mã thành viên | `memberId` |
| Email | `email` |
| Badge xác thực | `trust.isVerified` hoặc `emailVerified` tùy ý nghĩa label |
| Điểm uy tín | `trust.score` + `/100` |
| Hạng uy tín | `trust.level` |
| Đồ được bảo vệ | `stats.protectedItems` |
| Đồ an toàn | `stats.safeItems` |
| Đồ đang mất | `stats.lostItems` |
| Báo mất đang chạy | `stats.activeLostReports` |
| Trả đồ hoàn tất | `stats.completedReturns` |
| Lượt quét QR | `stats.qrScans` |

### Màu/badge trust gợi ý

Backend là nguồn duy nhất quyết định level:

| Level | Score | UI gợi ý |
| --- | ---: | --- |
| `BRONZE` | 0–49 | nâu/đồng |
| `SILVER` | 50–69 | xám/bạc |
| `GOLD` | 70–89 | vàng |
| `PLATINUM` | 90–100 | xanh tím/platinum |

App không tự tính lại level. Nếu muốn progress bar, dùng `trust.score / 100` và clamp UI trong `0..1` để phòng dữ liệu cũ.

### Loading và refresh

- Khi mở Profile: gọi một lần `getProfile()`.
- Pull-to-refresh: gọi lại `getProfile()`.
- Sau PATCH profile hoặc PATCH preferences: có thể dùng ngay full object response để cập nhật store; không bắt buộc request lại.
- Không request `/api/items` chỉ để lấy count.

## 5. GET `/api/auth/profile/stats`

Endpoint này là tùy chọn cho màn chỉ cần refresh thống kê mà không lấy lại toàn profile.

```ts
type GetProfileStatsResponse = ApiSuccess<ProfileStats>;
```

```json
{
  "success": true,
  "message": "Profile statistics loaded successfully",
  "data": {
    "protectedItems": 12,
    "safeItems": 10,
    "lostItems": 2,
    "activeLostReports": 1,
    "completedReturns": 4,
    "qrScans": 8
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

Màn Profile thông thường không cần gọi endpoint này vì `/profile` đã chứa `stats`.

## 6. PATCH `/api/auth/profile`

### Request type

```ts
export interface UpdateProfileRequest {
  displayName?: string;
  photoURL?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  bio?: string | null;
}
```

Backend vẫn nhận `addressCity` và `pushToken` cho client cũ, nhưng App mới không nên dùng.

### Quy tắc PATCH

- Không gửi field: giữ nguyên dữ liệu cũ.
- Gửi `null`: xóa dữ liệu đối với `photoURL`, `phoneNumber`, `address`, `bio`.
- `displayName`: string 2–50 ký tự sau trim.
- `photoURL`: HTTPS URL hợp lệ hoặc `null`. Chuỗi rỗng hiện được Backend chuyển thành `null`, nhưng App nên gửi rõ `null`.
- `phoneNumber`: 8–15 chữ số, có thể bắt đầu bằng `+`, hoặc `null`.
- `address`: tối đa 255 ký tự hoặc `null`.
- `bio`: tối đa 300 ký tự hoặc `null`.
- Body phải có ít nhất một field.
- Không gửi `id`, `email`, `memberId`, `trustScore`, `isVerified`, `createdAt`, `stats`, `preferences`.

### Request mẫu

```json
{
  "displayName": "Nguyễn Văn An",
  "photoURL": "https://cdn.example.com/avatar.jpg",
  "phoneNumber": "+84912345678",
  "address": "Quận 1, TP.HCM",
  "bio": "Tôi thường hoạt động tại khu vực Quận 1"
}
```

### Response

Response trả lại toàn bộ `UserProfile` mới, không chỉ field vừa cập nhật:

```ts
type UpdateProfileResponse = ApiSuccess<UserProfile>;
```

Message: `Profile updated successfully`.

### UI màn Edit Profile

- Khởi tạo form từ profile store.
- Nút Lưu disabled nếu form không thay đổi hoặc đang submit.
- Trim `displayName`, `phoneNumber`, `address`, `bio` trước khi so sánh dirty state.
- Nếu user bấm xóa avatar, gửi `{ "photoURL": null }`.
- Nếu user xóa sạch phone/address/bio, gửi field tương ứng là `null`, không nên bỏ field khỏi request.
- Khi thành công, replace profile trong auth/profile store bằng `response.data` rồi back.
- Khi lỗi validation, map `error.fields.<field>` vào lỗi dưới input.

### Lỗi validation mẫu

```json
{
  "success": false,
  "message": "Profile data is invalid",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "displayName": "Display name must be at least 2 characters"
    }
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

Số điện thoại trùng:

```json
{
  "success": false,
  "message": "Phone number is already in use",
  "error": {
    "code": "PHONE_ALREADY_USED"
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

App nên hiển thị lỗi này tại input số điện thoại, không dùng toast chung nếu màn form đang mở.

## 7. Notification Preferences

### Type

```ts
export interface NotificationPreferences extends ProfilePreferences {
  updatedAt: string;
}

export type UpdateNotificationPreferencesRequest = Partial<
  Pick<
    NotificationPreferences,
    | "pushEnabled"
    | "emailEnabled"
    | "proximityEnabled"
    | "notificationRadiusMeters"
    | "language"
  >
>;
```

### GET `/api/auth/profile/preferences`

```json
{
  "success": true,
  "message": "Preferences loaded successfully",
  "data": {
    "pushEnabled": true,
    "emailEnabled": false,
    "proximityEnabled": true,
    "notificationRadiusMeters": 3000,
    "language": "vi",
    "updatedAt": "2026-08-31T10:00:00.000Z"
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

Nếu user chưa có record preferences, Backend tự tạo defaults; App không cần special-case 404.

Defaults:

```ts
const DEFAULT_PROFILE_PREFERENCES = {
  pushEnabled: true,
  emailEnabled: false,
  proximityEnabled: true,
  notificationRadiusMeters: 3000,
  language: "vi" as const,
};
```

### PATCH `/api/auth/profile/preferences`

Hỗ trợ partial update:

```json
{
  "pushEnabled": false
}
```

Hoặc:

```json
{
  "emailEnabled": true,
  "proximityEnabled": true,
  "notificationRadiusMeters": 1000,
  "language": "vi"
}
```

Response có cùng shape với GET và message `Preferences updated successfully`.

### Hành vi nghiệp vụ cần phản ánh đúng trong UI

- `pushEnabled = false`: tắt push cho toàn bộ tài khoản trên mọi thiết bị. Notification trong Notification Center vẫn có thể được tạo.
- `emailEnabled = false`: tắt email nghiệp vụ tùy chọn; email bảo mật như OTP/reset password vẫn có thể được gửi.
- `proximityEnabled = false`: Backend không tạo notification loại `PROXIMITY`.
- `notificationRadiusMeters`: chỉ áp dụng cho proximity notification mới; không sửa radius của báo mất đã tạo trước đó.
- `language`: hiện chỉ nhận `vi` hoặc `en`.

### UI màn Notification Settings

Các control tối thiểu:

1. Switch “Thông báo đẩy” → `pushEnabled`.
2. Switch “Thông báo email” → `emailEnabled`.
3. Switch “Cảnh báo ở gần” → `proximityEnabled`.
4. Slider/select bán kính → `notificationRadiusMeters`, min 100, max 5000.
5. Language select → `vi | en` nếu App muốn expose ở giai đoạn này.

Quy tắc UX đề xuất:

- Disable control radius khi `proximityEnabled === false`, nhưng giữ giá trị cũ trong state.
- Khi bật/tắt switch, có thể optimistic update nhưng phải rollback nếu request lỗi.
- Với slider, chỉ PATCH khi user kết thúc thao tác để tránh spam request.
- Hiển thị radius dưới 1000 dưới dạng mét; từ 1000 trở lên có thể hiển thị km.
- Body PATCH không được rỗng.

Radius ngoài phạm vi trả:

```json
{
  "success": false,
  "message": "Notification radius is invalid",
  "error": {
    "code": "INVALID_NOTIFICATION_RADIUS",
    "fields": {
      "notificationRadiusMeters": "Number must be less than or equal to 5000"
    }
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

HTTP status là `422`.

## 8. Push token theo thiết bị

### Khái niệm quan trọng

- `pushEnabled`: setting toàn tài khoản.
- Device registration: push token của một installation cụ thể.
- Xóa một device không được xóa device khác.
- `deviceId` phải ổn định qua các lần mở app và refresh token; không tạo UUID mới mỗi lần launch.

### Lưu `deviceId` phía App

Khuyến nghị tạo một installation UUID ở lần chạy đầu tiên và lưu trong SecureStore/Keychain/EncryptedStorage:

```ts
async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync("installation_device_id");
  if (existing) return existing;

  const created = `${Platform.OS}-${crypto.randomUUID()}`;
  await SecureStore.setItemAsync("installation_device_id", created);
  return created;
}
```

Không dùng hardware identifier bị giới hạn quyền riêng tư. Không dùng Expo push token làm `deviceId`, vì token có thể rotate.

### POST `/api/auth/devices`

Gọi sau khi đồng thời có:

- User đã login.
- Notification permission đã được cấp.
- App lấy được Expo/FCM/APNs token phù hợp với backend provider.

Request:

```ts
export interface RegisterDeviceRequest {
  deviceId: string;
  platform: "android" | "ios" | "web";
  pushToken: string;
  appVersion?: string;
}
```

```json
{
  "deviceId": "android-8c733127",
  "platform": "android",
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxx]",
  "appVersion": "1.0.0"
}
```

Backend upsert theo `(userId, deviceId)`. Có thể gọi lại an toàn khi:

- App launch sau khi user đã đăng nhập.
- Push token rotate.
- App update version.
- User đăng nhập lại trên cùng installation.

Response hiện tại:

```json
{
  "success": true,
  "message": "Device push token registered successfully",
  "data": {
    "success": true,
    "deviceId": "android-8c733127",
    "device_id": "android-8c733127",
    "platform": "android",
    "enabled": true,
    "lastSeenAt": "2026-08-31T10:00:00.000Z"
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

`device_id` là alias cũ; App mới dùng `deviceId`.

### DELETE `/api/auth/devices/:deviceId`

Gọi trước hoặc trong luồng logout khi App vẫn còn access token hợp lệ:

```http
DELETE /api/auth/devices/android-8c733127
```

Response:

```json
{
  "success": true,
  "message": "Device unregistered",
  "data": {
    "success": true
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

Thứ tự logout đề xuất:

1. Đọc `deviceId` hiện tại.
2. Best-effort `DELETE /api/auth/devices/:deviceId`.
3. Gọi endpoint logout hiện có nếu App vẫn đang dùng.
4. Xóa access token, refresh token, profile store và cache nhạy cảm.
5. Điều hướng về Login.

Nếu DELETE device lỗi do mất mạng, vẫn cho user logout local. Backend tự disable token nếu FCM báo token không còn hợp lệ.

### Khi user từ chối notification permission

- Không gọi register device nếu chưa có push token hợp lệ.
- Không tự set `pushEnabled = false`; đây là lựa chọn cấp tài khoản, khác với permission của OS trên một thiết bị.
- UI nên hiển thị trạng thái OS permission riêng và có nút mở Settings của hệ điều hành.

## 9. Đổi mật khẩu

### Điều kiện hiển thị UI

```ts
const canChangePassword = profile.authProvider === "password";
```

- `password`: hiển thị “Đổi mật khẩu”.
- `google`, `firebase_phone`, `apple`: ẩn hoặc disable menu và hiển thị “Tài khoản này đăng nhập bằng nhà cung cấp bên ngoài”.

Không suy luận từ việc email có tồn tại.

### POST `/api/auth/change-password`

```ts
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
```

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

Mật khẩu mới:

- 8–100 ký tự.
- Có ít nhất một chữ hoa.
- Có ít nhất một chữ thường.
- Có ít nhất một chữ số.

Response:

```json
{
  "success": true,
  "message": "Password changed successfully. Please sign in again.",
  "data": null,
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

Backend revoke toàn bộ JWT cũ. Vì vậy ngay sau success App phải:

1. Không gọi API protected nào khác bằng token cũ.
2. Xóa access token và refresh token.
3. Clear auth/profile/query cache.
4. Reset navigation về Login.
5. Hiển thị snackbar/toast “Đổi mật khẩu thành công. Vui lòng đăng nhập lại.”

### UI form

- Mật khẩu hiện tại.
- Mật khẩu mới.
- Xác nhận mật khẩu mới chỉ kiểm tra phía App; không gửi field này lên Backend.
- Nút show/hide password.
- Checklist rule password trước khi submit.
- Không log request body trong analytics/crash logs.

### Social account error fallback

Nếu UI cũ vẫn mở màn đổi mật khẩu cho social account, Backend trả HTTP `403`:

```json
{
  "success": false,
  "message": "This account does not use a password",
  "error": {
    "code": "PASSWORD_NOT_SUPPORTED_FOR_PROVIDER"
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

App xử lý bằng cách đóng form và hiển thị thông báo phù hợp, không yêu cầu nhập lại mật khẩu cũ.

Sai mật khẩu hiện tại trả `401 / UNAUTHORIZED`. Tại màn form, hiển thị lỗi dưới field current password; không logout ngay chỉ dựa vào code này. Chỉ interceptor global logout khi request protected bị `401` do token/session và không phải lỗi nghiệp vụ từ endpoint change-password. Có thể phân biệt bằng request URL hoặc message.

Rate limit: tối đa 5 request trong 15 phút cho mỗi user. HTTP `429`, code `RATE_LIMITED`.

## 10. Xóa tài khoản

### UI/UX đề xuất

Luồng ba màn/modal:

1. Cảnh báo hậu quả và yêu cầu user xác nhận muốn tiếp tục.
2. Gửi OTP, hiển thị input 6 số và countdown 10 phút.
3. Sau khi xác nhận thành công, clear session và về Login.

Nội dung cảnh báo nên nói rõ:

- Tài khoản ngừng hoạt động ngay sau xác nhận.
- Push token và QR cũ bị vô hiệu hóa.
- Dữ liệu cá nhân được lên lịch xóa/ẩn danh sau 30 ngày.
- Một số dữ liệu giao dịch có thể được giữ dưới dạng ẩn danh theo nghiệp vụ.

### Bước 1: POST `/api/auth/account/deletion-otp`

Không có body.

```json
{
  "success": true,
  "message": "A verification code has been sent",
  "data": {
    "expiresInSeconds": 600
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

App dùng `expiresInSeconds` để chạy countdown. Không hardcode 600 nếu response có giá trị.

OTP:

- 6 chữ số.
- Hết hạn sau 10 phút.
- Chỉ dùng một lần.
- Sau 5 lần nhập sai, OTP bị vô hiệu hóa; user phải gửi lại OTP mới.
- Request gửi OTP bị rate limit 5 lần/15 phút/user.

### Bước 2: DELETE `/api/auth/account`

Body:

```json
{
  "otpCode": "123456",
  "confirmation": "DELETE"
}
```

`confirmation` là hằng số kỹ thuật, App gửi đúng chuỗi viết hoa `DELETE`. Không cần bắt user tự gõ nếu product không yêu cầu; có thể dùng checkbox/nút xác nhận rồi App tự gắn giá trị.

Response:

```json
{
  "success": true,
  "message": "Account deletion has been scheduled",
  "data": {
    "scheduledDeletionAt": "2026-09-30T10:00:00.000Z",
    "recoverableUntil": "2026-09-30T10:00:00.000Z"
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

Sau success:

1. Có thể lưu tạm `recoverableUntil` chỉ để hiển thị confirmation cuối.
2. Clear access token, refresh token, profile, push registration cache và query cache.
3. Reset navigation về Login/Welcome.
4. Không gọi DELETE device sau bước này vì access token đã bị revoke và devices đã được Backend disable.

OTP sai/hết hạn:

```json
{
  "success": false,
  "message": "Deletion verification code is invalid or expired",
  "error": {
    "code": "REAUTHENTICATION_REQUIRED"
  },
  "timestamp": "2026-08-31T10:00:00.000Z"
}
```

HTTP `403`. Giữ user ở màn OTP, hiển thị lỗi; nếu countdown hết hoặc đã sai nhiều lần thì cho nút “Gửi lại mã”.

## 11. Notification Center

Contract chính:

```text
GET   /v1/notifications
GET   /v1/notifications/unread-count
PATCH /v1/notifications/:id/read
POST  /v1/notifications/read-all
```

### List query

```http
GET /v1/notifications?page=1&limit=20&category=IMPORTANT
```

- `page`: integer từ 1.
- `limit`: integer từ 1, Backend cap tối đa 100.
- `category`: `IMPORTANT | TRANSACTION | ITEM | SOCIAL`.
- Sắp xếp `created_at DESC`.
- Chỉ trả notification của user hiện tại.

### Type

```ts
export type NotificationCategory =
  | "IMPORTANT"
  | "TRANSACTION"
  | "ITEM"
  | "SOCIAL";

export interface AppNotification {
  id: string;
  receiver_id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  dedupe_key?: string | null;
  delivery_status?: string;
  opened_at?: string | null;
  created_at: string;
}

export interface NotificationListData {
  data: AppNotification[];
  total_unread: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}
```

Lưu ý response endpoint list có hai lớp `data`:

```ts
const page = response.data.data; // NotificationListData
const notifications = page.data; // AppNotification[]
```

### Deep link từ metadata

App nên xử lý theo key có mặt:

| Metadata | Điều hướng |
| --- | --- |
| `room_id` | Chat room |
| `transaction_id` | Chi tiết giao dịch |
| `post_id` | Chi tiết báo mất/radar post |
| `item_id` | Chi tiết vật phẩm |

Ưu tiên theo `notification.type`, không chỉ theo category. Luôn validate metadata là string trước khi navigate.

### Read behavior

- `PATCH /:id/read` idempotent; có thể gọi lại.
- Khi user tap notification: update local `is_read = true` ngay, giảm unread local, rồi PATCH server; rollback hoặc refetch nếu cần.
- `POST /read-all` chỉ sửa notification của user hiện tại.
- Không gọi API cũ `/api/stream/notifications`.

## 12. API service mẫu

Ví dụ dùng Axios-style client đã tự gắn Bearer token:

```ts
export const profileApi = {
  async getProfile() {
    const response = await api.get<ApiSuccess<UserProfile>>(
      "/api/auth/profile"
    );
    return response.data.data;
  },

  async updateProfile(input: UpdateProfileRequest) {
    const response = await api.patch<ApiSuccess<UserProfile>>(
      "/api/auth/profile",
      input
    );
    return response.data.data;
  },

  async getStats() {
    const response = await api.get<ApiSuccess<ProfileStats>>(
      "/api/auth/profile/stats"
    );
    return response.data.data;
  },

  async getPreferences() {
    const response = await api.get<ApiSuccess<NotificationPreferences>>(
      "/api/auth/profile/preferences"
    );
    return response.data.data;
  },

  async updatePreferences(input: UpdateNotificationPreferencesRequest) {
    const response = await api.patch<ApiSuccess<NotificationPreferences>>(
      "/api/auth/profile/preferences",
      input
    );
    return response.data.data;
  },

  async registerDevice(input: RegisterDeviceRequest) {
    const response = await api.post(
      "/api/auth/devices",
      input
    );
    return response.data.data;
  },

  async unregisterDevice(deviceId: string) {
    const encoded = encodeURIComponent(deviceId);
    const response = await api.delete(
      `/api/auth/devices/${encoded}`
    );
    return response.data.data;
  },

  async changePassword(input: ChangePasswordRequest) {
    await api.post("/api/auth/change-password", input);
  },

  async requestDeletionOtp() {
    const response = await api.post<
      ApiSuccess<{ expiresInSeconds: number }>
    >("/api/auth/account/deletion-otp");
    return response.data.data;
  },

  async confirmDeletion(otpCode: string) {
    const response = await api.delete<
      ApiSuccess<{
        scheduledDeletionAt: string;
        recoverableUntil: string;
      }>
    >("/api/auth/account", {
      data: { otpCode, confirmation: "DELETE" },
    });
    return response.data.data;
  },
};
```

## 13. Store/cache phía App

Khuyến nghị một profile source of truth:

```ts
interface ProfileState {
  profile: UserProfile | null;
  status: "idle" | "loading" | "ready" | "error";
}
```

Sau các mutation:

- Update profile: replace `profile` bằng full response.
- Update preferences: merge response vào `profile.preferences` và settings cache.
- Change password: clear toàn bộ auth state.
- Delete account: clear toàn bộ auth state.
- Login/refresh response vẫn có user aliases; nên gọi lại `/profile` sau login để luôn có stats/preferences aggregate mới nhất nếu login response chưa có số liệu đầy đủ.

Nếu dùng TanStack Query:

```ts
const PROFILE_KEY = ["auth", "profile"] as const;
const PROFILE_PREFERENCES_KEY = ["auth", "profile", "preferences"] as const;
```

Sau update preferences, cập nhật cả hai cache để switch trên màn Settings và dữ liệu tóm tắt trên Profile không lệch nhau.

## 14. Error handling matrix

| HTTP | Code | App xử lý |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Map `error.fields` vào form |
| 401 | `UNAUTHORIZED` | Token/session: refresh hoặc logout; riêng sai current password thì hiển thị tại form |
| 403 | `REAUTHENTICATION_REQUIRED` | OTP xóa tài khoản sai/hết hạn |
| 403 | `PASSWORD_NOT_SUPPORTED_FOR_PROVIDER` | Ẩn/đóng màn đổi mật khẩu |
| 404 | `PROFILE_NOT_FOUND` | Clear session và về login/support state |
| 409 | `PHONE_ALREADY_USED` | Lỗi dưới input phone |
| 422 | `INVALID_NOTIFICATION_RADIUS` | Lỗi dưới slider/radius input |
| 429 | `RATE_LIMITED` | Disable submit tạm thời, hiển thị thử lại sau |
| 500 | `INTERNAL_ERROR` | Toast chung và retry |

Interceptor không nên tự động logout với mọi `401`. Endpoint change-password dùng `401 / UNAUTHORIZED` cho sai mật khẩu hiện tại. Cần loại trừ URL đó khỏi auto-logout hoặc chỉ auto-logout khi refresh token thất bại.

## 15. Những menu không cần API mới

| Menu | App xử lý |
| --- | --- |
| Đồ dùng của tôi | Điều hướng `MyItems` |
| Tin nhắn | Điều hướng `ChatInbox` |
| Thông báo | Điều hướng `Notifications` |
| Điều khoản dịch vụ | Mở URL/WebView |
| Chính sách bảo mật | Mở URL/WebView |
| Phiên bản | Lấy từ Expo/native config |
| Trợ giúp | Nội dung tĩnh hoặc website |
| Đăng xuất | Unregister device hiện tại rồi logout local/API |

KYC chưa có quy trình thật, vì vậy chưa nên hiển thị menu KYC như một tính năng hoạt động. Nếu vẫn hiển thị, dùng trạng thái “Sắp ra mắt”, không map `isVerified` thành xác minh giấy tờ.

## 16. Thứ tự rollout khuyến nghị

1. Backend deploy migration và API trước.
2. Kiểm tra `/api/auth/profile` ở staging với user cũ và user mới.
3. App cập nhật types để nhận cả camelCase mới và alias cũ.
4. App chuyển Profile stats sang dữ liệu `/profile`.
5. App thêm Edit Profile và Notification Settings.
6. App chuyển đăng ký push token sang device endpoint.
7. App thêm Change Password theo `authProvider`.
8. App thêm luồng Delete Account OTP.
9. App xác nhận Notification Center chỉ dùng `/v1/notifications`.
10. Sau khi tỷ lệ App cũ đủ thấp, lên ticket loại bỏ các alias legacy ở API version sau.

## 17. Checklist nghiệm thu phía App

### Profile

- [ ] Logout/login lại vẫn thấy display name, avatar, phone, address, bio đã sửa.
- [ ] Profile chỉ dùng một request chính.
- [ ] User có hơn một page items vẫn thấy count đúng.
- [ ] Trust score/level hiển thị đúng dữ liệu Backend, không tự quy đổi.
- [ ] Null avatar/phone/address/bio hiển thị fallback hợp lý.
- [ ] Validation error hiện đúng dưới từng field.

### Preferences

- [ ] Switch được khôi phục đúng sau kill/reopen app.
- [ ] Radius dưới 100 hoặc trên 5000 bị chặn ở UI và xử lý được lỗi 422.
- [ ] Tắt proximity làm disable radius control.
- [ ] Tắt push không bị hiểu nhầm là xóa device.

### Devices

- [ ] `deviceId` ổn định qua app restart.
- [ ] Push token rotate thì POST lại cùng deviceId.
- [ ] Logout thiết bị A không làm thiết bị B mất push.
- [ ] OS permission denied không làm app crash hoặc gửi token rỗng.

### Security

- [ ] Password account thấy menu đổi mật khẩu.
- [ ] Google/Apple/Firebase phone không bị yêu cầu mật khẩu nội bộ.
- [ ] Đổi mật khẩu thành công xóa token local và về Login.
- [ ] Delete account có OTP countdown 10 phút.
- [ ] OTP sai/hết hạn không xóa session ngay.
- [ ] Delete account thành công clear toàn bộ auth state.
- [ ] Mật khẩu và OTP không xuất hiện trong analytics/log/crash report.

### Notifications

- [ ] List có pagination và load-more đúng `hasNextPage`.
- [ ] Mark read idempotent.
- [ ] Read-all cập nhật unread badge.
- [ ] Deep link kiểm tra metadata trước khi navigate.
- [ ] Không còn request tới `/api/stream/notifications`.

## 18. Điều kiện Backend trước khi App test staging

Migration sau phải được deploy:

```text
prisma/migrations/20260831000000_profile_preferences_devices/migration.sql
```

Nếu chưa deploy migration, các endpoint preferences, devices, QR stats, token revocation và account deletion có thể lỗi database dù code API đã tồn tại.
