# ✅ Checklist Deploy Render.com

## 📋 Trước khi Deploy

### 1. Chuẩn bị Credentials

- [ ] **Gmail App Password** (cho SMTP)
  - Vào https://myaccount.google.com/apppasswords
  - Tạo app password mới
  - Copy 16 ký tự

- [ ] **Stream Chat API Keys**
  - Đăng ký tại https://getstream.io
  - Lấy API Key và API Secret

- [ ] **Google OAuth** (nếu dùng)
  - Vào https://console.cloud.google.com/apis/credentials
  - Tạo OAuth 2.0 Client ID
  - Copy Client ID và Client Secret

- [ ] **JWT Secrets** (tạo random strings)
  - Vào https://generate-secret.now.sh/32
  - Generate 2 secrets (JWT_SECRET và JWT_REFRESH_SECRET)

### 2. Push Code lên GitHub

```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

---

## 🚀 Deploy Steps

### Bước 1: Tạo Database

- [ ] Login vào https://dashboard.render.com
- [ ] Click "New +" → "PostgreSQL"
- [ ] Name: `backend-db`
- [ ] Database: `backend_db`
- [ ] Region: `Singapore` hoặc `Oregon`
- [ ] Plan: `Free`
- [ ] Click "Create Database"
- [ ] ⭐ **Copy "Internal Database URL"** → Lưu lại!

### Bước 2: Tạo Web Service

- [ ] Click "New +" → "Blueprint" (nếu có render.yaml)
  - HOẶC Click "Web Service" (deploy thủ công)
- [ ] Connect GitHub repository
- [ ] Branch: `main`
- [ ] Build Command:
  ```bash
  npm install && npx prisma generate && npm run build
  ```
- [ ] Start Command:
  ```bash
  npx prisma migrate deploy && npm start
  ```
- [ ] Region: Cùng region với database
- [ ] Plan: `Free`

### Bước 3: Thêm Environment Variables

Vào **Environment** tab, thêm tất cả biến sau:

#### Required (Bắt buộc)

- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3000`
- [ ] `DATABASE_URL` = `[paste URL từ bước 1]`
- [ ] `JWT_SECRET` = `[your-secret-32-chars]`
- [ ] `JWT_REFRESH_SECRET` = `[your-refresh-secret]`
- [ ] `JWT_EXPIRES_IN` = `7d`
- [ ] `JWT_REFRESH_EXPIRES_IN` = `30d`
- [ ] `APP_BASE_URL` = `https://your-app.onrender.com`

#### Email Configuration

- [ ] `SMTP_HOST` = `smtp.gmail.com`
- [ ] `SMTP_PORT` = `587`
- [ ] `SMTP_SECURE` = `false`
- [ ] `SMTP_USER` = `your-email@gmail.com`
- [ ] `SMTP_PASS` = `[gmail-app-password]`
- [ ] `SMTP_FROM_EMAIL` = `noreply@yourdomain.com`
- [ ] `SMTP_FROM_NAME` = `Your App Name`
- [ ] `SKIP_EMAIL_VERIFICATION` = `false`

#### Stream Chat

- [ ] `STREAM_API_KEY` = `[your-stream-key]`
- [ ] `STREAM_API_SECRET` = `[your-stream-secret]`

#### Google OAuth (Optional)

- [ ] `GOOGLE_CLIENT_ID` = `[your-client-id]`
- [ ] `GOOGLE_CLIENT_SECRET` = `[your-client-secret]`
- [ ] `GOOGLE_CALLBACK_URL` = `https://your-app.onrender.com/api/auth/google/callback`

### Bước 4: Deploy

- [ ] Click "Create Web Service"
- [ ] Đợi build (5-10 phút)
- [ ] Check logs tab để xem progress

---

## 🔧 Sau khi Deploy

### 1. Kiểm tra API hoạt động

```bash
curl https://your-app.onrender.com/health
```

- [ ] Response 200 OK

### 2. Update Google OAuth Callback URL

- [ ] Vào https://console.cloud.google.com/apis/credentials
- [ ] Chọn OAuth Client
- [ ] Thêm Authorized redirect URI:
  ```
  https://your-app.onrender.com/api/auth/google/callback
  ```
- [ ] Save

### 3. Test các tính năng chính

#### Test Registration

```bash
curl -X POST https://your-app.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "name": "Test User"
  }'
```

- [ ] Response 200/201
- [ ] Email verification nhận được (check inbox/spam)

#### Test Login

```bash
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

- [ ] Response 200 với access_token

#### Test Protected Route

```bash
curl https://your-app.onrender.com/api/items \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- [ ] Response 200 hoặc 401 nếu không có token

### 4. Verify Database

- [ ] Vào Render Dashboard → backend-db
- [ ] Click "Connect" → Copy connection command
- [ ] Chạy: `psql [connection-string]`
- [ ] Check tables: `\dt`
- [ ] Check users: `SELECT * FROM "User" LIMIT 5;`

---

## 🎉 Production Ready Checklist

- [ ] API đang chạy stable (không crash)
- [ ] Database migrations applied
- [ ] Email sending hoạt động
- [ ] Google OAuth working (nếu dùng)
- [ ] Stream Chat connected
- [ ] All endpoints test passed
- [ ] Error logs không có lỗi nghiêm trọng
- [ ] Environment variables đầy đủ và chính xác

---

## 📱 Lưu thông tin quan trọng

### API URL

```
https://your-app.onrender.com
```

### Database Connection String

```
[Copy từ Render Dashboard → backend-db → Connect]
```

### Admin Access

```
Email: admin@example.com
Password: [set in database or via seed]
```

---

## 🐛 Common Issues

### Issue 1: Build Failed

**Error**: Cannot find module 'typescript'

**Fix**: Di chuyển typescript sang dependencies

```json
"dependencies": {
  "typescript": "^5.9.3"
}
```

### Issue 2: Database Connection Error

**Error**: Can't reach database

**Fix**:

- Dùng Internal Database URL (không phải External)
- Đảm bảo cùng region với web service

### Issue 3: Migration Failed

**Error**: Migration engine error

**Fix**: Reset migrations

```bash
# In Render Shell
npx prisma migrate reset --force
npx prisma migrate deploy
```

### Issue 4: Cold Start Slow

**Issue**: First request sau 15 phút mất 30-60s

**Fix**: Nâng cấp lên Paid Plan ($7/month) để tắt auto-sleep

---

## 📊 Monitoring

### Check Service Health

- [ ] Vào Render Dashboard
- [ ] Click vào "backend-api"
- [ ] Xem tab "Metrics"
  - CPU Usage
  - Memory Usage
  - Response Time

### Check Logs

- [ ] Vào tab "Logs"
- [ ] Filter by "Error" để xem lỗi
- [ ] Setup log alerts (Settings → Notifications)

---

## 🔄 Update App

### Auto Deploy (Recommended)

```bash
# Just push to GitHub
git add .
git commit -m "Update feature"
git push origin main
# Render auto deploys!
```

### Manual Deploy

- [ ] Vào Render Dashboard → backend-api
- [ ] Click "Manual Deploy" → "Deploy latest commit"

---

## 💾 Backup Database

### Method 1: Via Render Dashboard

- [ ] Vào backend-db service
- [ ] Tab "Backups"
- [ ] Click "Create Backup"

### Method 2: Via CLI

```bash
# Get connection string from Render
pg_dump [connection-string] > backup_$(date +%Y%m%d).sql
```

---

## ✅ Deploy hoàn tất!

**Next Steps:**

1. Share API URL với Frontend team
2. Update Frontend .env với API URL
3. Test toàn bộ flow: Register → Login → Create Item → Chat
4. Monitor logs trong 24h đầu
5. Setup uptime monitoring (uptimerobot.com hoặc similar)

**API của bạn:**

```
https://your-app.onrender.com/api
```

**Health Check:**

```
https://your-app.onrender.com/health
```

---

🎊 **Chúc mừng! Bạn đã deploy thành công!** 🎊
