# 📤 Upload API Examples

## Upload ảnh

```bash
POST http://localhost:3000/api/upload/image
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: multipart/form-data

# Form data:
image: [file binary]
```

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "filename": "1736534400000-abc123xy.jpg",
    "originalName": "my-photo.jpg",
    "size": 245678,
    "mimeType": "image/jpeg",
    "url": "/public/uploads/1736534400000-abc123xy.jpg",
    "uploadedBy": "clx1234567890"
  }
}
```

**Truy cập ảnh:**
```
http://localhost:3000/public/uploads/1736534400000-abc123xy.jpg
```

---

## Xóa ảnh

```bash
DELETE http://localhost:3000/api/upload/1736534400000-abc123xy.jpg
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "data": null
}
```

---

## Validation Rules

### File constraints:
- **Max size**: 5MB
- **Allowed formats**: JPEG, JPG, PNG, WebP
- **Field name**: `image` (trong form-data)

### Error Responses:

**No file uploaded (400)**
```json
{
  "success": false,
  "message": "No file uploaded",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

**Invalid file type (400)**
```json
{
  "success": false,
  "message": "Invalid file type. Only JPEG, PNG and WebP are allowed",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

**File too large (400)**
```json
{
  "success": false,
  "message": "File too large. Maximum size is 5MB",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

**File not found (404)**
```json
{
  "success": false,
  "message": "File not found",
  "timestamp": "2026-01-10T10:00:00.000Z"
}
```

---

## Test với cURL

### Upload ảnh:
```bash
curl -X POST http://localhost:3000/api/upload/image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

### Test với Postman:
1. Method: **POST**
2. URL: `http://localhost:3000/api/upload/image`
3. Headers:
   - `Authorization: Bearer YOUR_TOKEN`
4. Body: 
   - Chọn **form-data**
   - Key: `image` (type: File)
   - Value: Chọn file ảnh

---

## Use Cases

### 1. Upload avatar
```bash
POST /api/upload/image
# Sau đó update profile
PATCH /api/auth/profile
{
  "photoURL": "http://localhost:3000/public/uploads/1736534400000-abc123xy.jpg"
}
```

### 2. Upload ảnh item
```bash
POST /api/upload/image
# Dùng URL khi tạo item
POST /api/items
{
  "name": "Laptop",
  "photoURL": "http://localhost:3000/public/uploads/1736534400000-abc123xy.jpg"
}
```

### 3. Upload ảnh trong message (chat)
```bash
POST /api/upload/image
# Gửi URL trong message
POST /api/messages
{
  "chatId": "chat123",
  "image": "http://localhost:3000/public/uploads/1736534400000-abc123xy.jpg"
}
```

---

## Storage Structure

```
backend-basic/
├── public/
│   └── uploads/
│       ├── 1736534400000-abc123xy.jpg
│       ├── 1736534500000-def456uv.png
│       └── 1736534600000-ghi789wx.webp
```

**Note**: Thư mục `public/uploads` được tự động tạo khi upload ảnh đầu tiên.
