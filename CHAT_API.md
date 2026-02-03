# Tài liệu API Chat (Chat API Documentation)

Tài liệu này cung cấp các API để khởi tạo và quản lý cuộc hội thoại giữa chủ sở hữu món đồ (Owner) và người tìm thấy (Finder). Hệ thống sử dụng Stream Chat làm nền tảng xử lý tin nhắn thời gian thực.

---

## 1. Lấy Token Kết nối (Stream Chat Token)

Mọi thiết bị phải gọi API này trước khi bắt đầu bất kỳ thao tác Chat nào. Token dùng để xác thực quyền hạn của User với server Stream Chat.

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
    }
  }
  ```

---

## 2. Tạo Cuộc hội thoại Mới (Create Channel)

Dùng khi người tìm thấy (Finder) quét mã QR và muốn nhắn tin cho chủ món đồ (Owner).

- **Endpoint**: `/api/stream/channels/:itemId/:finderId`
- **Method**: `POST`
- **Params**:
  - `itemId`: ID của món đồ từ mã QR (ví dụ: `it-123456`)
  - `finderId`: ID của người đang quét (thường là User hiện tại)
- **Response Success (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "channel": {
        "id": "item-id-xxxxxxxx",
        "type": "messaging",
        "name": "Chat về món đồ: Ví tiền"
      },
      "itemName": "Ví tiền"
    }
  }
  ```
- **Lưu ý**: Backend sẽ tự động thêm cả Owner và Finder vào trong Channel này.

---

## 3. Lấy Danh sách Hộp thư (Get Inbox)

Lấy tất cả các cuộc hội thoại mà người dùng đang tham gia (để hiện màn hình danh bạ/tin nhắn).

- **Endpoint**: `/api/stream/channels`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "total": 5,
      "channels": [
        {
          "id": "channel_01",
          "last_message": "Chào bạn, mình đã thấy ví của bạn",
          "unread_count": 2,
          "receiver": {
            "id": "user_id",
            "name": "Nguyễn Văn A",
            "image": "..."
          }
        }
      ]
    }
  }
  ```

---

## 4. Đóng Cuộc hội thoại (Close Channel)

Dùng khi món đồ đã được trả lại thành công và hai bên không cần chat với nhau nữa. Channel sẽ chuyển sang trạng thái "Read-only" (vẫn xem lại được tin nhắn cũ nhưng không gửi thêm được).

- **Endpoint**: `/api/stream/channels/:channelId/close`
- **Method**: `PUT`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Channel closed successfully"
  }
  ```

---

## Hướng dẫn cho bên App (Workflow)

1. **Khởi tạo**:
   - Gọi `GET /api/stream/token` để lấy Access Token cho SDK Chat.
   - Khởi tạo `StreamChatClient` trên App.

2. **Khi quét QR tìm thấy đồ**:
   - Gọi `POST /api/stream/channels/:itemId/:finderId`.
   - Lấy `channel.id` từ kết quả trả về để điều hướng người dùng vào màn hình Chat chi tiết.

3. **Gửi/Nhận tin nhắn**:
   - Sau khi có `channel.id`, App sử dụng trực tiếp các hàm của SDK Chat (ví dụ: `channel.sendMessage()`, `channel.watch()`) để nhắn tin thời gian thực. **Phần này App làm việc trực tiếp với SDK Stream, không cần gọi thêm qua API backend của mình.**

4. **Kết thúc giao dịch**:
   - Sau khi hoàn tất trả đồ, gọi `PUT /api/stream/channels/:channelId/close` để đóng hội thoại.
