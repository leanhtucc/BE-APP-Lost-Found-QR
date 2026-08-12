# 🚀 Backend Basic - Lost & Found API

API backend cho ứng dụng Lost & Found với TypeScript, Express, Prisma, PostgreSQL và Stream Chat.

## ✨ Features

- 🔐 **Authentication**: JWT-based auth với Google OAuth, Email Verification, Password Reset
- 📦 **Items Management**: Quản lý đồ thất lạc với QR code
- 💬 **Chat System**: Stream Chat integration cho real-time messaging
- 📧 **Email**: Email verification, welcome emails, password reset emails
- 📤 **Upload**: Upload ảnh với multer
- 🔒 **Security**: Rate limiting, validation, error handling

## 🚀 Quick Deploy

**Deploy lên Render.com miễn phí trong 10 phút:**

- 📖 [DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md) - Hướng dẫn deploy

## 📁 Cấu trúc Project

```
backend-basic/
├── prisma/
│   ├── migrations/          # Database migrations
│   └── schema.prisma        # Database schema
├── src/
│   ├── config/              # App configuration
│   │   ├── env.ts          # Environment variables
│   │   ├── database.ts     # Database config
│   │   └── index.ts
│   ├── libs/                # Shared libraries
│   │   ├── prisma.ts       # Prisma client
│   │   ├── jwt.ts          # JWT utilities
│   │   ├── logger.ts       # Logger
│   │   ├── stream-chat.ts  # Stream Chat utilities
│   │   └── redis.ts        # Redis client (TODO)
│   ├── middlewares/         # Express middlewares
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── modules/             # Domain modules
│   │   ├── auth/
│   │   ├── items/
│   │   ├── chat/           # Custom chat (optional)
│   │   ├── stream/         # Stream Chat integration
│   │   │   ├── stream.controller.ts
│   │   │   ├── stream.routes.ts
│   │   │   └── stream.schema.ts
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── response.ts     # API response helpers
│   │   ├── hash.ts         # Password hashing
│   │   ├── date.ts         # Date utilities
│   │   └── constants.ts    # App constants
│   ├── types/               # TypeScript types
│   │   └── express.d.ts    # Express type extensions
│   ├── app.ts              # Express app setup
│   └── server.ts           # Entry point
├── .env.example
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── Dockerfile
```

## 🎯 Kiến trúc

### Layered Architecture

```
Request → Routes → Middleware → Controller → Service → Repository → Database
```

### Vai trò từng layer:

- **Routes**: Định nghĩa endpoints và áp dụng middleware
- **Controller**: Xử lý HTTP request/response
- **Service**: Business logic
- **Repository**: Data access layer
- **Types**: TypeScript interfaces và types
- **Schema**: Validation schemas (Zod)

## 🚀 Cài đặt

### 1. Clone và install dependencies:

```bash
npm install
```

### 2. Khởi động Database với Docker:

```bash
docker compose up -d
```

### 3. Setup environment:

```bash
cp .env.example .env
# Chỉnh sửa .env với thông tin của bạn
```

### 4. Setup database:

```bash
# Tạo migration
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate

# Mở Prisma Studio để xem database
npm run prisma:studio
```

### 5. Chạy server:

```bash
# Development mode với hot reload
npm run dev

# Build cho production
npm run build

# Chạy production
npm start
```

## 📚 API Documentation

### Items Module

#### Tạo món đồ

```http
POST /api/items
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Ví da đen",
  "category": "wallet",
  "description": "Ví da màu đen",
  "lostMessage": "Mình làm rơi ở sảnh A"
}
```

#### Quét QR (Lấy thông tin món đồ)

```http
GET /api/items/{itemId}?token={securityToken}
```

#### Cập nhật trạng thái

```http
PATCH /api/items/{itemId}/status
Authorization: Bearer {token}

{
  "status": "lost",
  "lostMessage": "Làm rơi ở..."
}
```

#### Lấy danh sách món đồ của user

```http
GET /api/items
Authorization: Bearer {token}
```

#### Xóa món đồ

```http
DELETE /api/items/{itemId}
Authorization: Bearer {token}
```

### Chat Module (NEW! 💬)

**Tính năng Chat Real-time giữa Owner và Finder**

Hệ thống chat hỗ trợ 3 loại tin nhắn:

- 💬 Text: Tin nhắn văn bản
- 📷 Image: Gửi hình ảnh bằng chứng
- 📍 Location: Gửi vị trí GPS để hẹn gặp

#### Tạo/Lấy cuộc hội thoại

```http
POST /api/chats
Authorization: Bearer {token}
Content-Type: application/json

{
  "itemId": "clx123abc",
  "finderId": "user_id_123"
}
```

#### Gửi tin nhắn

```http
POST /api/chats/{chatId}/messages
Authorization: Bearer {token}

{
  "text": "Mình nhặt được đồ của bạn",
  "messageType": "text"
}
```

#### Gửi hình ảnh

```http
POST /api/chats/{chatId}/messages
Authorization: Bearer {token}

{
  "text": "Đây là ảnh món đồ",
  "image": "https://storage.example.com/image.jpg",
  "messageType": "image"
}
```

#### Gửi vị trí

```http
POST /api/chats/{chatId}/messages
Authorization: Bearer {token}

{
  "text": "Tôi đang ở đây",
  "location": {
    "lat": 10.762622,
    "lng": 106.660172
  },
  "messageType": "location"
}
```

#### Lấy danh sách tin nhắn

```http
GET /api/chats/{chatId}/messages?limit=50&cursor=messageId
Authorization: Bearer {token}
```

#### Lấy Inbox (Danh sách chat)

```http
GET /api/chats
Authorization: Bearer {token}
```

#### Đánh dấu đã đọc

```http
PUT /api/chats/{chatId}/read
Authorization: Bearer {token}
```

#### Đóng cuộc hội thoại

```http
PUT /api/chats/{chatId}/close
Authorization: Bearer {token}
```

**📚 Chi tiết đầy đủ:**

- [CHAT_API.md](docs/CHAT_API.md) - API Documentation

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Authentication**: JWT
- **Security**: Helmet

## 📝 Scripts

```bash
npm run dev              # Chạy development server
npm run build            # Build cho production
npm start                # Chạy production server
npm run prisma:migrate   # Tạo và apply migration
npm run prisma:generate  # Generate Prisma Client
npm run prisma:studio    # Mở Prisma Studio
```

## 🔒 Security Features

- Helmet.js cho security headers
- Rate limiting
- JWT authentication
- Request validation với Zod
- Error handling middleware
- Security token cho QR codes

## 📖 Tài liệu thêm

### General

- [GUIDE.md](docs/GUIDE.md) - Hướng dẫn chi tiết cách code API
- [Prisma Docs](https://www.prisma.io/docs)
- [Express Docs](https://expressjs.com/)

### Authentication

- [AUTH_API_EXAMPLES.md](docs/AUTH_API_EXAMPLES.md) - Auth API Examples
- [EMAIL_VERIFICATION.md](docs/EMAIL_VERIFICATION.md) - Email Verification Guide
- [PASSWORD_RESET_API.md](docs/PASSWORD_RESET_API.md) - 🔐 **Password Reset API Guide**
- [GOOGLE_AUTH.md](docs/GOOGLE_AUTH.md) - Google OAuth Setup

### Chat System

- [CHAT_API.md](docs/CHAT_API.md) - 🔥 **Stream Chat Integration Guide**

## 💬 Stream Chat Features

| Feature                      | Status |
| ---------------------------- | ------ |
| Real-time WebSocket          | ✅     |
| Typing indicators            | ✅     |
| Read receipts                | ✅     |
| UI Components (React Native) | ✅     |
| File uploads                 | ✅     |
| Offline support              | ✅     |
| Free tier (100 MAU)          | ✅     |

## 🤝 Contributing

Contributions are welcome! Vui lòng tạo issue hoặc pull request.

## 📄 License

MIT
npx prisma studio

````

👉 Mở browser để xem & chỉnh sửa dữ liệu trực tiếp.

## 7️⃣ Chạy backend

```bash
npm run dev
````

Server mặc định: `http://localhost:3000`

## 📌 Done!

Giờ bạn có thể:

- ✅ Viết API CRUD
- 🔐 Mở rộng User + JWT Auth
