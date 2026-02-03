# Tài liệu API Kiểm duyệt (Moderation API Documentation)

Tài liệu này cung cấp các API dùng để kiểm duyệt nội dung, báo cáo vi phạm và quản lý người dùng trong các cuộc hội thoại (Chat) giữa người nhặt được đồ và chủ sở hữu.

---

## 1. Báo cáo Tin nhắn Vi phạm (Flag Message)

Dùng khi người dùng muốn báo cáo một tin nhắn có nội dung xấu, xúc phạm hoặc lừa đảo.

- **Endpoint**: `/api/stream/messages/:messageId/flag`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "flag": {
        "user_id": "nguoi_bao_cao",
        "target_message_id": "message_id_bi_flag",
        "created_at": "..."
      }
    },
    "message": "Message flagged successfully"
  }
  ```

---

## 2. Gỡ bỏ Báo cáo (Unflag Message)

Dùng để hoàn tác việc báo cáo nếu người dùng bấm nhầm.

- **Endpoint**: `/api/stream/messages/:messageId/flag`
- **Method**: `DELETE`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Message unflagged successfully"
  }
  ```

---

## 3. Tắt tiếng Người dùng (Mute User)

Dùng để không nhận thông báo hoặc tin nhắn từ một người cụ thể trong một khoảng thời gian hoặc vĩnh viễn (chỉ trong phạm vi channel đó).

- **Endpoint**: `/api/stream/channels/:channelId/mute/:targetUserId`
- **Method**: `POST`
- **Query Params**:
  - `timeout` (optional): Thời gian tắt tiếng tính bằng phút. Nếu không truyền sẽ là vĩnh viễn đến khi Unmute.
- **Example**: `/api/stream/channels/ch1/mute/user2?timeout=60` (Mute 1 tiếng)
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User muted successfully"
  }
  ```

---

## 4. Bỏ Tắt tiếng (Unmute User)

Khôi phục khả năng nhận tin nhắn/thông báo từ người đã bị Mute.

- **Endpoint**: `/api/stream/channels/:channelId/mute/:targetUserId`
- **Method**: `DELETE`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User unmuted successfully"
  }
  ```

---

## 5. Chặn Người dùng khỏi Cuộc hội thoại (Ban User)

Dùng để đuổi một người ra khỏi cuộc hội thoại và không cho họ quay lại (thường dùng khi gặp người có dấu hiệu lừa đảo hoặc quấy rối).

- **Endpoint**: `/api/stream/channels/:channelId/ban/:targetUserId`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "reason": "Spam and scamming content",
    "timeout": 1440
  }
  ```
- **Params**:
  - `reason` (optional): Lý do chặn.
  - `timeout` (optional): Thời gian chặn (phút).
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User banned successfully"
  }
  ```

---

## 6. Lấy Danh sách Tin nhắn bị Flag (Dành cho Admin/Owner)

Xem lại tất cả các tin nhắn đã bị báo cáo trong một cuộc hội thoại.

- **Endpoint**: `/api/stream/channels/:channelId/flagged-messages`
- **Method**: `GET`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "total": 2,
      "messages": [
        {
          "id": "msg_01",
          "text": "Nội dung vi phạm",
          "user": { "id": "user_id", "name": "..." },
          "flags_count": 1
        }
      ]
    }
  }
  ```

---

## Tóm tắt cho bên App:

- **Flag**: Dùng để báo cáo cho hệ thống biết nội dung rác/xấu.
- **Mute**: Dùng cá nhân (tôi không muốn nghe người này nói nữa).
- **Ban**: Dùng để quản lý cuộc hội thoại (đuổi người này ra khỏi nhóm chat của món đồ đó).
- **Lưu ý**: Các tính năng `Ban` và `Unban` thường chỉ dành cho chủ sở hữu món đồ (Item Owner) hoặc quản trị viên hệ thống.
