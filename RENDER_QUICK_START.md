# 🚀 Deploy lên Render.com trong 10 phút

## Bước 1: Chuẩn bị (2 phút)

### 1.1. Lấy Gmail App Password

1. Vào https://myaccount.google.com/apppasswords
2. Tạo app password mới
3. Copy 16 ký tự

### 1.2. Lấy Stream Chat Keys

1. Đăng ký tại https://getstream.io
2. Tạo app mới
3. Copy API Key và API Secret

### 1.3. Generate JWT Secrets

1. Vào https://generate-secret.now.sh/32
2. Generate 2 secrets (cho JWT_SECRET và JWT_REFRESH_SECRET)

## Bước 2: Push code lên GitHub (1 phút)

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## Bước 3: Tạo Database trên Render (2 phút)

1. Login vào https://dashboard.render.com
2. Click **New +** → **PostgreSQL**
3. Điền:
   - Name: `backend-db`
   - Database: `backend_db`
   - Region: `Singapore` hoặc `Oregon`
   - Plan: **Free**
4. Click **Create Database**
5. **⭐ Copy "Internal Database URL"** → Lưu lại!

## Bước 4: Deploy Web Service (3 phút)

### Option A: Dùng Blueprint (Khuyến nghị)

1. Click **New +** → **Blueprint**
2. Connect GitHub repository
3. Render tự động phát hiện `render.yaml`
4. Click **Apply**

### Option B: Deploy thủ công

1. Click **New +** → **Web Service**
2. Connect GitHub repo
3. Điền:
   - Name: `backend-api`
   - Region: Cùng với database
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npx prisma migrate deploy && npm start`
   - Plan: **Free**

## Bước 5: Add Environment Variables (2 phút)

Vào **Environment** tab, add các biến sau:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=[paste Internal URL từ bước 3]
JWT_SECRET=[your-generated-secret]
JWT_REFRESH_SECRET=[your-generated-secret]
SMTP_USER=your-email@gmail.com
SMTP_PASS=[gmail-app-password]
SMTP_FROM_EMAIL=noreply@yourdomain.com
STREAM_API_KEY=[your-stream-key]
STREAM_API_SECRET=[your-stream-secret]
APP_BASE_URL=https://your-app.onrender.com
```

Click **Save Changes**

## Bước 6: Đợi Deploy (5-10 phút)

- Xem logs trong tab **Logs**
- Đợi status chuyển sang **Live**

## Bước 7: Test API

```powershell
# Windows
.\test-render-deployment.ps1 https://your-app.onrender.com

# Or manual
curl https://your-app.onrender.com/health
```

---

## ✅ Checklist

- [ ] Database created và có Internal URL
- [ ] Web Service deployed thành công
- [ ] Environment variables đã add đầy đủ
- [ ] Health check trả về 200 OK
- [ ] Test registration endpoint
- [ ] Test login endpoint
- [ ] Email verification hoạt động

---

## 🐛 Nếu có lỗi

### Build Failed

→ Check logs tab, thường là thiếu dependencies

### Database Connection Error

→ Dùng Internal URL, không phải External URL

### 502 Bad Gateway

→ App đang start, đợi 1-2 phút

### Email không gửi được

→ Check Gmail App Password, không dùng password thường

---

## 📚 Đọc thêm

- [RENDER_DEPLOY_GUIDE.md](RENDER_DEPLOY_GUIDE.md) - Hướng dẫn chi tiết
- [RENDER_CHECKLIST.md](RENDER_CHECKLIST.md) - Checklist đầy đủ
- [GMAIL_SETUP_GUIDE.md](GMAIL_SETUP_GUIDE.md) - Setup email

---

**🎉 Xong! API của bạn đã live tại: `https://your-app.onrender.com`**
