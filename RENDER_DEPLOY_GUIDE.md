# 🚀 Hướng dẫn Deploy lên Render.com

## ✨ Tại sao chọn Render.com?

- ✅ **Free tier** với PostgreSQL database miễn phí
- ✅ Auto-deploy từ GitHub
- ✅ SSL certificate tự động
- ✅ Không cần credit card
- ✅ Setup đơn giản, ít config

## 📋 Yêu cầu trước khi bắt đầu

- [ ] Tài khoản GitHub (project đã push lên GitHub)
- [ ] Tài khoản Render.com (đăng ký tại [render.com](https://render.com))
- [ ] Gmail account cho SMTP (xem [GMAIL_SETUP_GUIDE.md](GMAIL_SETUP_GUIDE.md))
- [ ] Stream Chat API keys (tại [getstream.io](https://getstream.io))
- [ ] Google OAuth credentials (nếu dùng) - xem [docs/GOOGLE_AUTH.md](docs/GOOGLE_AUTH.md)

---

## 🎯 PHƯƠNG PHÁP 1: Deploy với render.yaml (Khuyến nghị)

### Bước 1: Push code lên GitHub

```bash
# Nếu chưa có git repo
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### Bước 2: Kết nối với Render.com

1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect GitHub repository của bạn
4. Render sẽ tự động phát hiện file `render.yaml`
5. Click **"Apply"**

### Bước 3: Cấu hình Environment Variables

Render sẽ tự động tạo services theo `render.yaml`, nhưng bạn cần thêm các biến môi trường sau:

1. Vào **Dashboard** → chọn **backend-api** service
2. Vào tab **"Environment"**
3. Thêm các biến sau:

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your App Name

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-app.onrender.com/api/auth/google/callback

# Stream Chat
STREAM_API_KEY=your-stream-api-key
STREAM_API_SECRET=your-stream-api-secret

# App URL
APP_BASE_URL=https://your-app.onrender.com
```

4. Click **"Save Changes"**

### Bước 4: Trigger Deploy

- Render sẽ tự động deploy
- Xem logs trong tab **"Logs"**
- Đợi khoảng 5-10 phút

### Bước 5: Kiểm tra

```bash
# Test API
curl https://your-app.onrender.com/health
```

---

## 🎯 PHƯƠNG PHÁP 2: Deploy thủ công (Không dùng render.yaml)

### Bước 1: Tạo PostgreSQL Database

1. Đăng nhập [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Điền thông tin:
   - **Name**: `backend-db`
   - **Database**: `backend_db`
   - **User**: `backend_user`
   - **Region**: `Oregon` (hoặc `Singapore` gần VN hơn)
   - **Plan**: `Free`
4. Click **"Create Database"**
5. Đợi database khởi tạo
6. **Copy** "Internal Database URL" (quan trọng!)

### Bước 2: Tạo Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect GitHub repository
3. Điền thông tin:
   - **Name**: `backend-api`
   - **Region**: `Oregon` (cùng với database)
   - **Branch**: `main`
   - **Root Directory**: để trống
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npx prisma migrate deploy && npm start
     ```
   - **Plan**: `Free`

### Bước 3: Thêm Environment Variables

Scroll xuống **"Environment Variables"**, thêm tất cả biến sau:

```env
NODE_ENV=production
PORT=3000
API_PREFIX=/api

# Database (paste URL từ bước 1)
DATABASE_URL=postgresql://backend_user:password@dpg-xxx.oregon-postgres.render.com/backend_db

# JWT (Generate tại https://generate-secret.now.sh/32)
JWT_SECRET=your-super-secret-32-chars-minimum
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-32-chars-minimum
JWT_REFRESH_EXPIRES_IN=30d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your App Name
SKIP_EMAIL_VERIFICATION=false

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-app.onrender.com/api/auth/google/callback

# Stream Chat
STREAM_API_KEY=your-stream-api-key
STREAM_API_SECRET=your-stream-api-secret

# App URL
APP_BASE_URL=https://your-app.onrender.com
```

### Bước 4: Deploy

1. Click **"Create Web Service"**
2. Render sẽ bắt đầu build và deploy
3. Xem logs trong tab **"Logs"**

---

## 🔧 Cấu hình Google OAuth Callback URL

Sau khi deploy xong, cập nhật Google OAuth settings:

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Chọn OAuth 2.0 Client ID của bạn
3. Thêm **Authorized redirect URIs**:
   ```
   https://your-app.onrender.com/api/auth/google/callback
   ```
4. Click **"Save"**

---

## 📊 Giới hạn của Free Tier

⚠️ **Lưu ý quan trọng:**

| Tính năng       | Giới hạn                    |
| --------------- | --------------------------- |
| **RAM**         | 512 MB                      |
| **CPU**         | Shared                      |
| **Disk**        | Ephemeral (mất khi restart) |
| **Database**    | 1 GB storage                |
| **Sleep after** | 15 phút không hoạt động     |
| **Cold start**  | ~30-60 giây khi wake up     |
| **Bandwidth**   | 100 GB/tháng                |

### ⚠️ Điều quan trọng:

- **API sẽ "ngủ" sau 15 phút không có request**
- Request đầu tiên sau khi ngủ sẽ mất 30-60 giây (cold start)
- **File uploads sẽ bị MẤT khi service restart** (dùng cloud storage như AWS S3, Cloudinary)

---

## 🎨 Giải pháp cho File Uploads

Vì Render Free tier dùng ephemeral storage, file uploads sẽ mất khi restart. Giải pháp:

### Option 1: Cloudinary (Khuyến nghị)

```bash
npm install cloudinary multer-storage-cloudinary
```

### Option 2: AWS S3

```bash
npm install @aws-sdk/client-s3 multer-s3
```

### Option 3: UploadThing

```bash
npm install uploadthing
```

---

## 🔄 Auto Deploy từ GitHub

Render tự động deploy khi bạn push code:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Render sẽ tự động deploy!
```

### Tắt Auto Deploy:

1. Vào **Settings** → **Build & Deploy**
2. Tắt **"Auto-Deploy"**

---

## 📝 Xem Logs

```bash
# Trong Render Dashboard
1. Chọn service "backend-api"
2. Click tab "Logs"
3. Xem real-time logs
```

---

## 🐛 Troubleshooting

### ❌ Build Failed

**Lỗi**: `Cannot find module 'typescript'`

**Giải pháp**: Di chuyển typescript từ devDependencies sang dependencies:

```json
// package.json
"dependencies": {
  "typescript": "^5.9.3",
  "ts-node": "^10.9.2"
}
```

### ❌ Database Connection Error

**Lỗi**: `Can't reach database server`

**Giải pháp**:

1. Kiểm tra DATABASE_URL đúng format
2. Đảm bảo database và web service cùng region
3. Dùng **Internal Database URL** (không phải External)

### ❌ Prisma Migration Failed

**Lỗi**: `Migration failed to apply`

**Giải pháp**:

```bash
# Trong Render Shell (Settings → Shell)
npx prisma migrate reset --force
npx prisma migrate deploy
```

### ❌ Service keeps crashing

**Kiểm tra logs**:

1. Tab "Logs"
2. Tìm lỗi cuối cùng
3. Thường là thiếu environment variables

---

## 🎯 Checklist sau khi Deploy

- [ ] API đang chạy: `https://your-app.onrender.com/health`
- [ ] Database migrations thành công
- [ ] Email verification hoạt động (test register)
- [ ] Google OAuth callback URL đã update
- [ ] Stream Chat working
- [ ] Test các API endpoints chính
- [ ] Setup monitoring (optional)

---

## 📈 Upgrade lên Paid Plan

Nếu cần performance tốt hơn:

| Plan         | Giá       | RAM    | Sleep    |
| ------------ | --------- | ------ | -------- |
| **Starter**  | $7/tháng  | 512 MB | No sleep |
| **Standard** | $25/tháng | 2 GB   | No sleep |
| **Pro**      | $85/tháng | 4 GB   | No sleep |

---

## 🔗 Links hữu ích

- 📖 [Render Documentation](https://render.com/docs)
- 💬 [Render Community](https://community.render.com)
- 🎫 [Support](https://render.com/support)
- 📊 [Status Page](https://status.render.com)

---

## 🎉 Hoàn thành!

API của bạn đã sẵn sàng tại:

```
https://your-app.onrender.com/api
```

Test thử:

```bash
curl https://your-app.onrender.com/health
```

---

## 📞 Cần hỗ trợ?

- Check [GMAIL_SETUP_GUIDE.md](GMAIL_SETUP_GUIDE.md) để setup email
- Check [docs/GOOGLE_AUTH.md](docs/GOOGLE_AUTH.md) để setup Google OAuth
- Check [STREAM_CHAT_GUIDE.md](STREAM_CHAT_GUIDE.md) để setup Stream Chat
