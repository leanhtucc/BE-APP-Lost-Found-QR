# 🚀 Backend Basic - Lost & Found API

API backend cho ứng dụng Lost & Found với TypeScript, Express, Prisma và PostgreSQL.

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
│   │   └── redis.ts        # Redis client (TODO)
│   ├── middlewares/         # Express middlewares
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── modules/             # Domain modules
│   │   ├── auth/
│   │   ├── items/
│   │   │   ├── items.controller.ts
│   │   │   ├── items.service.ts
│   │   │   ├── items.repository.ts
│   │   │   ├── items.routes.ts
│   │   │   ├── items.schema.ts
│   │   │   └── items.types.ts
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

- [GUIDE.md](GUIDE.md) - Hướng dẫn chi tiết cách code API
- [Prisma Docs](https://www.prisma.io/docs)
- [Express Docs](https://expressjs.com/)

## 🤝 Contributing

Contributions are welcome! Vui lòng tạo issue hoặc pull request.

## 📄 License

MIT
npx prisma studio
```

👉 Mở browser để xem & chỉnh sửa dữ liệu trực tiếp.

## 7️⃣ Chạy backend

```bash
npm run dev
```

Server mặc định: `http://localhost:3000`

## 📌 Done!

Giờ bạn có thể:

- ✅ Viết API CRUD
- 🔐 Mở rộng User + JWT Auth
