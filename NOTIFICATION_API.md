# 📄 NOTIFICATION API – Tài liệu ghép nối cho App (FindBack Alerts)

> **Base URL:** `/v1/notifications` hoặc `/api/notifications`
>
> **Auth:** Tất cả endpoint đều yêu cầu header `Authorization: Bearer <token>`

---

## 1. Cấu trúc 1 Notification Object

Mỗi thông báo trả về từ API có cấu trúc sau:

```jsonc
{
  "id": "clxyz123abc",                    // ID thông báo (cuid)
  "receiver_id": "cluserid456",           // ID người nhận
  "category": "IMPORTANT",                // Phân loại (dùng để filter theo Tab)
  "type": "MATCH_FOUND",                  // Mã loại (dùng để render UI + deep link)
  "title": "Tìm thấy tín hiệu phù hợp", // Tiêu đề hiển thị
  "content": "iPhone 15 có người báo tìm thấy trong bán kính 300m", // Nội dung tóm tắt
  "metadata": {                           // ⭐ Data động – xem bảng bên dưới
    "distance": "300m",
    "post_id": "post-123",
    "item_name": "iPhone 15"
  },
  "is_read": false,                       // Trạng thái đã đọc
  "created_at": "2026-05-08T10:00:00.000Z"
}
```

### Giá trị `category` (Enum – dùng cho Tab filtering)

| Giá trị | Ý nghĩa | Tab UI |
|---|---|---|
| `IMPORTANT` | Thông báo quan trọng, cần hành động ngay | ⚡ Quan trọng |
| `TRANSACTION` | Giao dịch tiền, escrow, hoàn tiền | 💰 Giao dịch |
| `ITEM` | Cập nhật trạng thái vật phẩm | 📦 Vật phẩm |
| `SOCIAL` | Chat, tin nhắn, tương tác xã hội | 💬 Xã hội |

### Giá trị `type` và Metadata tương ứng

| `type` | `category` | Metadata mẫu | Deep Link FE |
|---|---|---|---|
| `MATCH_FOUND` | `IMPORTANT` | `{"distance": "300m", "post_id": "...", "item_name": "..."}` | Mở Radar Map / Chi tiết tin báo mất |
| `PROXIMITY` | `IMPORTANT` | `{"distance": "100m", "post_id": "..."}` | Mở Live Tracking Map |
| `QR_SCANNED` | `ITEM` | `{"item_id": "...", "room_id": "...", "finder_id": "..."}` | Mở Chat Room với người nhặt |
| `NEW_CHAT` | `SOCIAL` | `{"room_id": "...", "sender_avatar": "...", "message_preview": "...", "item_id": "..."}` | Mở Chat Room |
| `ESCROW_LOCKED` | `TRANSACTION` | `{"amount": 500000, "transaction_id": "...", "status": "locked", "post_id": "..."}` | Mở chi tiết Giao dịch |
| `REFUNDED` | `TRANSACTION` | `{"amount": 500000, "transaction_id": "...", "status": "refunded", "post_id": "..."}` | Mở chi tiết Giao dịch |
| `RELEASED` | `TRANSACTION` | `{"amount": 500000, "transaction_id": "...", "status": "released", "post_id": "..."}` | Mở chi tiết Giao dịch |

> **Lưu ý:** `metadata` là JSONB, các field bên trong có thể khác nhau tùy `type`. App nên dùng optional chaining khi đọc.

---

## 2. Endpoints

### 2.1. Lấy danh sách thông báo

```
GET /v1/notifications?category=IMPORTANT&page=1&limit=20
```

**Query Params:**

| Param | Type | Required | Mặc định | Mô tả |
|---|---|---|---|---|
| `category` | string | ❌ | *(tất cả)* | Filter theo tab: `IMPORTANT`, `TRANSACTION`, `ITEM`, `SOCIAL` |
| `page` | number | ❌ | `1` | Trang hiện tại |
| `limit` | number | ❌ | `20` | Số item/trang (max 100) |

**Response (200):**

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "data": [
      {
        "id": "notif-001",
        "receiver_id": "user-123",
        "category": "IMPORTANT",
        "type": "MATCH_FOUND",
        "title": "Tìm thấy tín hiệu phù hợp",
        "content": "iPhone 15 có người báo tìm thấy trong bán kính 300m",
        "metadata": {
          "distance": "300m",
          "post_id": "post-123",
          "item_name": "iPhone 15"
        },
        "is_read": false,
        "created_at": "2026-05-08T10:00:00.000Z"
      }
    ],
    "total_unread": 5,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3,
      "hasNextPage": true
    }
  },
  "timestamp": "2026-05-08T10:01:00.000Z"
}
```

> **⭐ `total_unread`** luôn trả về tổng thông báo chưa đọc của **toàn bộ user** (không bị ảnh hưởng bởi filter `category`). Dùng con số này để hiển thị badge đỏ ở icon 🔔.

---

### 2.2. Đánh dấu 1 thông báo đã đọc

```
PATCH /v1/notifications/:id/read
```

**Params:**

| Param | Type | Mô tả |
|---|---|---|
| `id` | string (path) | ID của thông báo cần đánh dấu |

**Response (200):**

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "notif-001",
    "receiver_id": "user-123",
    "category": "IMPORTANT",
    "type": "MATCH_FOUND",
    "title": "Tìm thấy tín hiệu phù hợp",
    "content": "...",
    "metadata": { "..." },
    "is_read": true,
    "created_at": "2026-05-08T10:00:00.000Z"
  },
  "timestamp": "2026-05-08T10:05:00.000Z"
}
```

**Lỗi có thể gặp:**

| HTTP Code | Nguyên nhân |
|---|---|
| `404` | Notification không tồn tại hoặc không thuộc user hiện tại |

---

### 2.3. Đánh dấu TẤT CẢ đã đọc

```
POST /v1/notifications/read-all
```

**Body:** Không cần body. Server tự lấy user từ token.

**Response (200):**

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updated_count": 12
  },
  "timestamp": "2026-05-08T10:05:00.000Z"
}
```

> `updated_count` = số thông báo vừa được chuyển từ chưa đọc → đã đọc. Nếu đã đọc hết rồi thì trả về `0`.

---

### 2.4. Lấy số thông báo chưa đọc (Nhanh)

```
GET /v1/notifications/unread-count
```

**Response (200):**

```json
{
  "success": true,
  "message": "Unread notification count retrieved successfully",
  "data": {
    "unread_count": 5
  },
  "timestamp": "2026-05-08T10:01:00.000Z"
}
```

> **Dùng khi nào?** Polling nhẹ để cập nhật badge 🔔 mà không cần load toàn bộ danh sách.

---

## 3. Real-time: Socket.io (Foreground Banner)

Khi App đang mở, server đẩy thông báo mới qua Socket.io.

### Kết nối

```typescript
import { io } from "socket.io-client";

const socket = io("https://api.findback.vn", {
  auth: { token: "<access_token>" }
});
```

### Lắng nghe event

```typescript
socket.on("notification:new", (notification) => {
  // notification = 1 NotificationDTO object (cấu trúc giống mục 1)
  // → Hiện banner nổi (flash message)
  // → Cập nhật badge count
  // → Thêm vào đầu danh sách nếu đang ở màn thông báo
});
```

### Ví dụ data nhận được:

```json
{
  "id": "notif-007",
  "receiver_id": "user-123",
  "category": "TRANSACTION",
  "type": "ESCROW_LOCKED",
  "title": "Giao dịch an toàn",
  "content": "500.000đ đã được khóa trong escrow",
  "metadata": {
    "amount": 500000,
    "transaction_id": "txn-789",
    "status": "locked",
    "post_id": "post-456"
  },
  "is_read": false,
  "created_at": "2026-05-08T12:00:00.000Z"
}
```

---

## 4. Push Notification: FCM (Background)

Khi App đang đóng, server gửi push qua Firebase Cloud Messaging.

### FCM Payload structure

```json
{
  "notification": {
    "title": "Giao dịch an toàn",
    "body": "500.000đ đã được khóa trong escrow"
  },
  "data": {
    "id": "notif-007",
    "receiver_id": "user-123",
    "category": "TRANSACTION",
    "type": "ESCROW_LOCKED",
    "is_read": "false",
    "created_at": "2026-05-08T12:00:00.000Z",
    "metadata": "{\"amount\":500000,\"transaction_id\":\"txn-789\",\"status\":\"locked\",\"post_id\":\"post-456\"}"
  }
}
```

> **Lưu ý:** Trong FCM `data`, tất cả value đều là **string**. `metadata` được JSON.stringify. App cần `JSON.parse(data.metadata)` khi xử lý.

### Priority

| Category | FCM Priority |
|---|---|
| `IMPORTANT` | `high` (hiện ngay, đánh thức thiết bị) |
| `TRANSACTION` | `high` |
| `ITEM` | `normal` |
| `SOCIAL` | `normal` |

---

## 5. Gợi ý tích hợp cho App (React Native)

### 5.1. Tab Filtering

```typescript
// Khi user chuyển tab
const loadNotifications = async (category?: string, page = 1) => {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (category) params.append("category", category);

  const res = await fetch(`${API}/v1/notifications?${params}`, { headers });
  const json = await res.json();

  // json.data.data        → mảng thông báo
  // json.data.total_unread → badge đỏ
  // json.data.pagination   → phân trang
};
```

### 5.2. Deep Link từ Notification

```typescript
const handleNotificationPress = (notification) => {
  const { type, metadata } = notification;

  switch (type) {
    case "MATCH_FOUND":
      navigation.navigate("RadarMap", { postId: metadata.post_id });
      break;
    case "PROXIMITY":
      navigation.navigate("LiveTracking", { postId: metadata.post_id });
      break;
    case "NEW_CHAT":
      navigation.navigate("ChatRoom", { roomId: metadata.room_id });
      break;
    case "QR_SCANNED":
      navigation.navigate("ChatRoom", { roomId: metadata.room_id });
      break;
    case "ESCROW_LOCKED":
    case "REFUNDED":
    case "RELEASED":
      navigation.navigate("TransactionDetail", { txnId: metadata.transaction_id });
      break;
  }

  // Đánh dấu đã đọc
  await fetch(`${API}/v1/notifications/${notification.id}/read`, {
    method: "PATCH", headers
  });
};
```

### 5.3. Empty State

Nếu `data.data` là mảng rỗng `[]`, hiển thị giao diện "Không có thông báo mới" với các card tĩnh (hard-code bên FE): "Bảo mật tài khoản", "Mẹo tìm kiếm", v.v.

---

## 6. Tóm tắt tất cả Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/v1/notifications` | Lấy danh sách thông báo (có filter, phân trang) |
| `GET` | `/v1/notifications/unread-count` | Lấy số thông báo chưa đọc |
| `PATCH` | `/v1/notifications/:id/read` | Đánh dấu 1 thông báo đã đọc |
| `POST` | `/v1/notifications/read-all` | Đánh dấu tất cả đã đọc |
