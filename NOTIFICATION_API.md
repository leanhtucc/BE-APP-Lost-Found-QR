# Tài liệu API Thông báo (Notification API Documentation)

Tài liệu này cung cấp chi tiết các API liên quan đến hệ thống thông báo dành cho Mobile App. Hệ thống bao gồm **Push Notifications** (thông báo đẩy qua Firebase/Expo) và **In-app Notifications** (thông báo trong ứng dụng qua Stream Chat).

---

## 1. Cập nhật Push Token

Dùng để gửi Token định danh thiết bị lên hệ thống, cho phép backend gửi thông báo đẩy (FCM/APNs) khi app không hoạt động.

- **Endpoint**: `/api/auth/profile`
- **Method**: `PATCH`
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
       "id": "user_id",
       "email": "example@gmail.com",
       "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
       ...
    },
    "message": "Profile updated successfully"
  }
  ```

---

## 2. Kết nối Hệ thống Thông báo Real-time

Trước khi sử dụng các chức năng thông báo trong app, App cần lấy Token để kết nối vào bộ SDK Stream Chat.

- **Endpoint**: `/api/stream/token`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "apiKey": "stream_api_key_xxxxxxxx",
      "userId": "user_id_trong_he_thong"
    },
    "message": "Stream token generated successfully"
  }
  ```
- **Lưu ý**: App nên gọi API này ngay sau khi đăng nhập thành công và khởi tạo Stream Chat Client.

---

## 3. Lấy Danh sách Thông báo (Inbox)

Lấy danh sách các thông báo/hoạt động của người dùng (giống màn hình Activity Feed).

- **Endpoint**: `/api/stream/notifications`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "total": 5,
      "unreadTotal": 2,
      "notifications": [
        {
          "id": "notification_id",
          "type": "item_found",
          "actor": { "id": "user_a", "name": "Nguyễn Văn A" },
          "item": { "id": "item_id", "name": "Chìa khóa xe" },
          "isRead": false,
          "createdAt": "2024-02-02T10:00:00Z"
        }
      ]
    }
  }
  ```

---

## 4. Đánh dấu Đã đọc Tất cả

Dùng khi người dùng xóa dấu chấm đỏ thông báo hoặc vào màn hình danh sách thông báo.

- **Endpoint**: `/api/stream/notifications/mark-read`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "All notifications marked as read"
  }
  ```

---

## 5. Ghi nhận Hoạt động (Tạo thông báo tự động)

App có thể chủ động log một hành động để hệ thống tự động sinh thông báo cho bên liên quan.

- **Endpoint**: `/api/stream/activity/:activityType`
- **Method**: `POST`
- **URL Params**: `:activityType` có thể là:
  - `new_message`: Có tin nhắn mới.
  - `item_found`: Có người quét QR báo tìm thấy món đồ.
  - `item_returned`: Món đồ đã được trả lại thành công.
- **Query Params (Metadata)**: Tùy vào loại activity, bạn có thể truyền thêm thông tin.
  - Ví dụ: `?itemId=abc&finderName=John`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Activity logged successfully"
  }
  ```

---

## Quy trình tích hợp cho App (Workflow)

1. **Giai đoạn Đăng nhập/Khởi động**:
   - Bước 1: Gọi `/api/auth/login` (hoặc register).
   - Bước 2: Gọi `/api/auth/profile` để cập nhật `pushToken` của thiết bị.
   - Bước 3: Gọi `/api/stream/token` và lưu vào biến toàn cục của App.

2. **Giai đoạn nhận Thông báo**:
   - Nếu App đang mở (Foreground): Bộ SDK Stream sẽ tự động bắn Event, App lắng nghe và hiện thông báo in-app.
   - Nếu App đang đóng (Background): Backend sẽ tự gửi Push Notification thông qua `pushToken` đã lưu.

3. **Giai đoạn Tương tác**:
   - Khi vào tab Thông báo: Gọi `/api/stream/notifications` để lấy danh sách.
   - Sau khi xem xong: Gọi `/api/stream/notifications/mark-read`.
