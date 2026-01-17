# 🧪 Stream Chat API Testing Guide

## Luồng Test Hoàn Chỉnh

### Setup

- **Base URL**: `http://localhost:3000`
- **Tool**: Postman, Thunder Client, hoặc cURL

---

## 📝 Bước 1: Đăng ký 2 Users

### User 1 - Owner (Chủ đồ)

```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "displayName": "Nguyen Van A",
  "email": "owner@test.com",
  "password": "password123"
}
```

**Lưu lại**: `accessToken` của Owner

---

### User 2 - Finder (Người nhặt)

```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "displayName": "Tran Thi B",
  "email": "finder@test.com",
  "password": "password123"
}
```

**Lưu lại**: `accessToken` của Finder

---

## 📦 Bước 2: Owner tạo Item (Đồ thất lạc)

````bash
POST http://localhost:3000/api/items
Authorization: Bearer {OWNER_TOKEN}
Content-Type: application/json

{
  "name": "Ví da đen",
  "category": "wallet",
  "description": "Ví da màu đen có chứa CMND",
  "lostMessage": "Làm rơi ở sảnh A lúc 10h sáng"
}
```


**Response:**

```json
{
  "success": true,
  "data": {
    "id": "clx123abc",
    "itemId": "ITEM_ABC123",
    "name": "Ví da đen",
    "qrCodeUrl": "http://localhost:3000/api/scan?id=ITEM_ABC123&token=xyz",
    "securityToken": "xyz789"
  }
}
````

**Lưu lại**:

- `id` (clx123abc) - dùng cho tạo channel
- `ownerId` từ token decode

---

## 💬 Bước 3: Finder quét QR và lấy thông tin

```bash
GET http://localhost:3000/api/scan?id=ITEM_ABC123&token=xyz789
```

**Response:**

```json
{
  "success": true,
  "data": {
    "item": {
      "id": "clx123abc",
      "name": "Ví da đen",
      "category": "wallet",
      "lostMessage": "Làm rơi ở sảnh A lúc 10h sáng"
    },
    "owner": {
      "displayName": "Nguyen Van A"
    }
  }
}
```

---

## 🔑 Bước 4: Finder lấy Stream Chat Token

```bash
GET http://localhost:3000/api/stream/token
Authorization: Bearer {FINDER_TOKEN}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "apiKey": "your_stream_api_key",
    "userId": "finder_user_id"
  }
}
```

**Lưu lại**: `token` và `apiKey` để test trên frontend

---

## 💬 Bước 5: Finder tạo Channel để nhắn tin

```bash
POST http://localhost:3000/api/stream/channels/{ITEM_ID}/{FINDER_USER_ID}
Authorization: Bearer {FINDER_TOKEN}
```

**Ví dụ cụ thể:**

```bash
POST http://localhost:3000/api/stream/channels/clx123abc/finder_user_id_123
Authorization: Bearer {FINDER_TOKEN}
```

**Response:**

```json
{
  "success": true,
  "message": "Channel created successfully",
  "data": {
    "channel": {
      "channelId": "item_cmkh1bvk90001ubu8xz3hqqig_cmkfmhklt0001ubx42de8huo9",
      "channelType": "messaging"
    },
    "itemName": "Ví da đen"
  },
  "timestamp": "2026-01-16T15:45:55.415Z"
}
{
    "success": true,
    "message": "Stream token generated successfully",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY21rZm0wb2QyMDAwMHVieDQzZmVxMjk2aSJ9.DCdPRbkF6TJSK2NJ34fJPz-BmhYNhWiT4Z3O3C5HVeU",
        "apiKey": "6bsfwyu8js67",
        "userId": "cmkfm0od20000ubx43feq296i"
    },
    "timestamp": "2026-01-16T15:48:01.012Z"
}
```

**Lưu lại**: `channelId` để dùng cho các bước sau

---

## 📬 Bước 6: Owner lấy Stream Token

```bash
GET http://localhost:3000/api/stream/token
Authorization: Bearer {OWNER_TOKEN}
```

Owner cũng cần token để xem tin nhắn.

---

## 📋 Bước 7: Owner xem danh sách Channels (Inbox)

```bash
GET http://localhost:3000/api/stream/channels
Authorization: Bearer {OWNER_TOKEN}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "id": "item_clx123abc_finder_user_id_123",
        "type": "messaging",
        "created_at": "2026-01-15T10:30:00Z",
        "member_count": 2,
        "last_message_at": "2026-01-15T10:35:00Z"
      }
    ],
    "total": 1
  }
}
```

---

## 🔒 Bước 8: Đóng Channel (sau khi trả đồ xong)

```bash
PUT http://localhost:3000/api/stream/channels/{CHANNEL_ID}/close
Authorization: Bearer {OWNER_TOKEN}
```

**Ví dụ cụ thể:**

```bash
PUT http://localhost:3000/api/stream/channels/item_clx123abc_finder_user_id_123/close
Authorization: Bearer {OWNER_TOKEN}
```

**Response:**

```json
{
  "success": true,
  "message": "Channel closed successfully",
  "data": {}
}
```

---

## 🎯 Test với Postman Collection

### Tạo Collection với các request sau

1. **Setup Folder**
   - Register Owner
   - Register Finder
   - Create Item

2. **Chat Flow Folder**
   - Get Finder Token
   - Create Channel
   - Get Owner Token
   - Get Owner Channels
   - Close Channel

### Variables để dùng

```json
{
  "baseUrl": "http://localhost:3000",
  "ownerToken": "{{ownerAccessToken}}",
  "finderToken": "{{finderAccessToken}}",
  "itemId": "{{itemId}}",
  "finderId": "{{finderId}}",
  "channelId": "{{channelId}}"
}
```

---

## 🧪 Quick Test Script (cURL)

Chạy toàn bộ trong terminal:

```bash
# 1. Register Owner
OWNER_RESPONSE=$(curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Owner","email":"owner@test.com","password":"pass123"}')
OWNER_TOKEN=$(echo $OWNER_RESPONSE | jq -r '.data.accessToken')
OWNER_ID=$(echo $OWNER_RESPONSE | jq -r '.data.user.id')

# 2. Register Finder
FINDER_RESPONSE=$(curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Finder","email":"finder@test.com","password":"pass123"}')
FINDER_TOKEN=$(echo $FINDER_RESPONSE | jq -r '.data.accessToken')
FINDER_ID=$(echo $FINDER_RESPONSE | jq -r '.data.user.id')

# 3. Create Item
ITEM_RESPONSE=$(curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Wallet","category":"wallet","description":"Black wallet"}')
ITEM_ID=$(echo $ITEM_RESPONSE | jq -r '.data.id')

# 4. Get Finder Stream Token
curl -X GET http://localhost:3000/api/stream/token \
  -H "Authorization: Bearer $FINDER_TOKEN"

# 5. Create Channel
curl -X POST "http://localhost:3000/api/stream/channels/$ITEM_ID/$FINDER_ID" \
  -H "Authorization: Bearer $FINDER_TOKEN"

# 6. Get Owner Channels
curl -X GET http://localhost:3000/api/stream/channels \
  -H "Authorization: Bearer $OWNER_TOKEN"

# 7. Close Channel
CHANNEL_ID="item_${ITEM_ID}_${FINDER_ID}"
curl -X PUT "http://localhost:3000/api/stream/channels/$CHANNEL_ID/close" \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

---

## ✅ Checklist Test

- [ ] Owner đăng ký thành công
- [ ] Finder đăng ký thành công
- [ ] Owner tạo item thành công
- [ ] Finder quét QR và thấy thông tin item
- [ ] Finder lấy Stream token thành công
- [ ] Finder tạo channel thành công
- [ ] Owner lấy Stream token thành công
- [ ] Owner thấy channel trong inbox
- [ ] Owner đóng channel thành công

---

## 🐛 Troubleshooting

### Lỗi 401 Unauthorized

- Check token còn hạn không
- Check header `Authorization: Bearer {token}`

### Lỗi 404 Item not found

- Check `itemId` có đúng không
- Check item có thuộc về owner không

### Lỗi Stream API

- Check `.env` có `STREAM_API_KEY` và `STREAM_API_SECRET`
- Check server đã restart sau khi thêm env

### Channel không tạo được

- Check `finderId` có đúng không
- Check user đã register với Stream chưa (tự động qua `/token`)

---

## 📱 Test Frontend Integration

Sau khi test backend OK, test trên React Native:

```javascript
// 1. Login
const { accessToken } = await login("finder@test.com", "pass123");

// 2. Get Stream Token
const { token, apiKey, userId } = await getStreamToken(accessToken);

// 3. Connect Stream Client
const client = StreamChat.getInstance(apiKey);
await client.connectUser({ id: userId }, token);

// 4. Create Channel
const response = await fetch(`${API_URL}/stream/channels/${itemId}/${userId}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}` },
});

// 5. Watch Channel
const { channelId, channelType } = await response.json();
const channel = client.channel(channelType, channelId);
await channel.watch();

// 6. Send Message
await channel.sendMessage({ text: "Xin chào, tôi nhặt được đồ của bạn!" });
```

---

**Happy Testing! 🚀**
