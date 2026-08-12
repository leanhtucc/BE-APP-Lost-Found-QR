# 📖 Hướng Dẫn Code API - Lost & Found Backend

## 🎯 Pattern MVC trong Project này

```
Request → Routes → Controller → Service → Prisma → Database
```

### 1️⃣ **Routes** (items.routes.ts)
- Định nghĩa các endpoint API
- Kết nối với Controller
- Áp dụng middleware

```typescript
router.post("/", authMiddleware, itemsController.createItem);
router.get("/:itemId", itemsController.getItem);
```

### 2️⃣ **Controller** (items.controller.ts)
- Nhận HTTP request từ routes
- Validate dữ liệu đầu vào
- Gọi Service để xử lý logic
- Trả về HTTP response

```typescript
async createItem(req: Request, res: Response) {
  const { name, category } = req.body;
  const item = await itemsService.createItem({ name, category });
  return res.status(201).json({ success: true, data: item });
}
```

### 3️⃣ **Service** (items.service.ts)
- Xử lý business logic
- Giao tiếp với database qua Prisma
- Không quan tâm đến HTTP

```typescript
async createItem(data) {
  const item = await prisma.item.create({ data });
  return item;
}
```

---

## 🚀 Cách Tạo API Mới

### Ví dụ: Tạo module **Chats**

#### **Bước 1: Tạo Service** (`chats.service.ts`)
```typescript
import { prisma } from "../../prisma";

export class ChatsService {
  async createChat(itemId: string, ownerId: string, finderId: string) {
    const chat = await prisma.chat.create({
      data: {
        chatId: `chat-${Date.now()}`,
        itemId,
        ownerId,
        finderId,
      },
    });
    return chat;
  }

  async getChatMessages(chatId: string) {
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });
    return messages;
  }
}
```

#### **Bước 2: Tạo Controller** (`chats.controller.ts`)
```typescript
import { Request, Response } from "express";
import { ChatsService } from "./chats.service";

const chatsService = new ChatsService();

export class ChatsController {
  async createChat(req: Request, res: Response) {
    try {
      const { itemId, finderId } = req.body;
      const ownerId = req.user?.id;

      const chat = await chatsService.createChat(itemId, ownerId, finderId);

      return res.status(201).json({
        success: true,
        data: chat,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}
```

#### **Bước 3: Tạo Routes** (`chats.routes.ts`)
```typescript
import { Router } from "express";
import { ChatsController } from "./chats.controller";
import { authMiddleware } from "../../middleware/auth";

const router = Router();
const chatsController = new ChatsController();

router.post("/", authMiddleware, chatsController.createChat);
router.get("/:chatId/messages", authMiddleware, chatsController.getChatMessages);

export default router;
```

#### **Bước 4: Đăng ký Routes trong App** (`app.ts`)
```typescript
import chatsRoutes from "./modules/chats/chats.routes";

app.use("/api/chats", chatsRoutes);
```

---

## 📦 Cách Test API

### 1. Cài dependencies:
```bash
npm install
```

### 2. Tạo file `.env`:
```bash
cp .env.example .env
```

### 3. Setup database:
```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Chạy server:
```bash
npm run dev
```

### 5. Test với cURL hoặc Postman:

**Tạo món đồ:**
```bash
POST http://localhost:3000/api/items
Headers: Authorization: Bearer YOUR_TOKEN
Body: {
  "name": "Ví da đen",
  "category": "wallet",
  "description": "Ví da màu đen"
}
```

**Quét QR (lấy thông tin món đồ):**
```bash
GET http://localhost:3000/api/items/abc-123-xyz?token=security-token-here
```

**Cập nhật trạng thái:**
```bash
PATCH http://localhost:3000/api/items/abc-123-xyz/status
Headers: Authorization: Bearer YOUR_TOKEN
Body: {
  "status": "lost",
  "lostMessage": "Mình làm rơi ví ở sảnh tòa nhà A"
}
```

---

## 💡 Tips Quan Trọng

### ✅ Luôn validate dữ liệu ở Controller
```typescript
if (!name || !category) {
  return res.status(400).json({ message: "Missing required fields" });
}
```

### ✅ Xử lý lỗi đúng cách
```typescript
try {
  // code
} catch (error: any) {
  if (error.message === "Not found") {
    return res.status(404).json({ message: "Not found" });
  }
  return res.status(500).json({ message: "Server error" });
}
```

### ✅ Dùng middleware cho authentication
```typescript
router.post("/", authMiddleware, controller.create);
```

### ✅ Dùng Prisma include để join bảng
```typescript
const item = await prisma.item.findUnique({
  where: { id },
  include: {
    owner: true,  // Join với bảng User
    chats: true,  // Join với bảng Chat
  },
});
```

---

## 🎓 Tóm Tắt Luồng Code

1. **Client** gửi request → `POST /api/items`
2. **Routes** nhận request → Gọi `itemsController.createItem`
3. **Controller** validate → Gọi `itemsService.createItem(data)`
4. **Service** xử lý logic → Gọi `prisma.item.create()`
5. **Prisma** tương tác với PostgreSQL
6. **Response** trả về: `{ success: true, data: item }`

---

Giờ bạn đã hiểu cách code API trong project này! 🎉
