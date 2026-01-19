# 📧 Hướng dẫn Setup Resend Email (Fix lỗi Render SMTP timeout)

## 🎯 Tại sao dùng Resend?

- ✅ **FREE**: 3,000 emails/tháng
- ✅ **HTTP API**: Không bị Render block (khác SMTP)
- ✅ **Dễ setup**: Chỉ cần API key
- ✅ **Nhanh & Ổn định**: Delivery rate cao

---

## 🚀 Các bước Setup

### 1️⃣ Tạo tài khoản Resend

1. Truy cập: **https://resend.com**
2. Click **"Sign Up"** (đăng ký bằng GitHub hoặc email)
3. Xác nhận email

### 2️⃣ Lấy API Key

1. Sau khi đăng nhập, vào: **https://resend.com/api-keys**
2. Click **"Create API Key"**
3. Đặt tên: `Production API Key`
4. Chọn permission: **"Sending access"**
5. Click **Create** → Copy API key (bắt đầu bằng `re_...`)

⚠️ **Quan trọng**: Lưu API key ngay, chỉ hiện 1 lần!

### 3️⃣ Cấu hình Local (.env)

Cập nhật file `.env`:

```env
# Email (Resend API)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxx"  # ← Paste API key vừa copy
EMAIL_FROM_ADDRESS="onboarding@resend.dev"  # ← Email test mặc định
EMAIL_FROM_NAME="Lost & Found Team"
```

### 4️⃣ Cấu hình trên Render

1. Vào **Render Dashboard** → Your Service
2. Chọn tab **"Environment"**
3. Click **"Add Environment Variable"**
4. Thêm 3 biến:

```
Key: RESEND_API_KEY
Value: re_xxxxxxxxxxxxxxxxxx

Key: EMAIL_FROM_ADDRESS
Value: onboarding@resend.dev

Key: EMAIL_FROM_NAME
Value: Lost & Found Team
```

5. Click **"Save Changes"** → Render sẽ tự động redeploy

---

## 🧪 Test Local

```bash
npm run dev
```

Test registration API với email thật để kiểm tra nhận được code!

---

## ✅ Email gửi từ địa chỉ nào?

**Ban đầu (Testing)**:

- `onboarding@resend.dev` (domain test của Resend)
- ✅ Hoạt động ngay không cần verify
- ⚠️ Có thể vào spam

**Sau này (Production)**:
Verify domain của bạn (vd: `noreply@yourdomain.com`):

1. Vào: https://resend.com/domains
2. Click **"Add Domain"**
3. Nhập domain của bạn
4. Add DNS records vào domain provider
5. Verify → Dùng `noreply@yourdomain.com` trong `EMAIL_FROM_ADDRESS`

---

## 📊 Free Tier Limits

- **3,000 emails/tháng**
- **100 emails/ngày** (nếu dùng onboarding@resend.dev)
- **Unlimited** daily emails (sau khi verify domain)

---

## 🐛 Troubleshooting

### Lỗi: "API key not configured"

→ Kiểm tra `RESEND_API_KEY` đã được set chưa

### Email không nhận được

1. Kiểm tra spam folder
2. Verify API key đúng chưa
3. Check logs trên Render: https://dashboard.render.com

### Vượt quota

→ Upgrade plan hoặc đợi đầu tháng sau reset

---

## 🔗 Links hữu ích

- Dashboard: https://resend.com/overview
- API Keys: https://resend.com/api-keys
- Domains: https://resend.com/domains
- Docs: https://resend.com/docs

---

✅ **Xong! Email service giờ sẽ hoạt động trên Render!**
