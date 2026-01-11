# 📧 Hướng Dẫn Cấu Hình Gmail SMTP

## 🎯 Mục đích

Hướng dẫn cấu hình Gmail để gửi email verification codes và các email thông báo từ ứng dụng Lost & Found.

---

## 📝 Bước 1: Bật Xác Thực 2 Bước (2FA)

1. Truy cập: https://myaccount.google.com/security
2. Tìm phần **"Signing in to Google"**
3. Click **"2-Step Verification"**
4. Follow các bước để bật 2FA (nếu chưa có)

> ⚠️ **Quan trọng:** Phải bật 2FA mới có thể tạo App Password!

---

## 🔑 Bước 2: Tạo App Password

1. Truy cập: https://myaccount.google.com/apppasswords

   Hoặc:
   - Vào https://myaccount.google.com/security
   - Tìm **"App passwords"** trong phần "Signing in to Google"

2. Chọn:
   - **Select app:** Mail
   - **Select device:** Other (Custom name)
   - Nhập tên: `Lost & Found API`

3. Click **"Generate"**

4. **Copy mật khẩu 16 ký tự** (dạng: `xxxx xxxx xxxx xxxx`)

   > 💡 Lưu lại mật khẩu này, chỉ hiển thị 1 lần!

---

## ⚙️ Bước 3: Cấu Hình File `.env`

Mở file `.env` và cập nhật:

```env
# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"           # ← Thay bằng Gmail của bạn
SMTP_PASS="xxxx xxxx xxxx xxxx"             # ← Dán App Password (16 ký tự)
SMTP_FROM_EMAIL="your-email@gmail.com"      # ← Email hiển thị khi gửi
SMTP_FROM_NAME="Lost & Found Team"          # ← Tên người gửi
```

### 📋 Ví dụ thực tế:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="lenahtu1123@gmail.com"
SMTP_PASS="abcd efgh ijkl mnop"
SMTP_FROM_EMAIL="lenahtu1123@gmail.com"
SMTP_FROM_NAME="Lost & Found Team"
```

---

## 🧪 Bước 4: Test Gửi Email

1. **Restart server:**

   ```bash
   npm run dev
   ```

2. **Gửi request đăng ký:**

   ```
   POST http://localhost:3000/api/auth/register?email=test@gmail.com&password=Test1234&displayName=Test User
   ```

3. **Kiểm tra email:**
   - Mở inbox của `test@gmail.com`
   - Tìm email từ "Lost & Found Team"
   - Lấy verification code (6 chữ số)

4. **Verify email:**
   ```
   POST http://localhost:3000/api/auth/verify-email?email=test@gmail.com&code=123456
   ```

---

## ❗ Xử Lý Lỗi Thường Gặp

### 🔴 Error: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Nguyên nhân:**

- Chưa bật 2FA
- App Password sai
- Đang dùng password Gmail thông thường thay vì App Password

**Giải pháp:**

1. Kiểm tra đã bật 2FA chưa
2. Tạo lại App Password mới
3. Copy đúng 16 ký tự (bỏ khoảng trắng hoặc giữ nguyên)

---

### 🔴 Error: "EAUTH"

**Nguyên nhân:** Xác thực thất bại

**Giải pháp:**

1. Kiểm tra lại `SMTP_USER` (phải là email đầy đủ)
2. Kiểm tra lại `SMTP_PASS` (phải là App Password, không phải password Gmail)
3. Restart server sau khi sửa `.env`

---

### 🔴 Email không đến inbox

**Nguyên nhân:** Email có thể vào Spam/Junk

**Giải pháp:**

1. Kiểm tra folder Spam/Junk
2. Mark email "Not Spam"
3. Thêm `SMTP_FROM_EMAIL` vào Contacts

---

## 🔒 Bảo Mật

### ✅ Nên làm:

- ✅ Lưu `.env` trong `.gitignore`
- ✅ Tạo App Password riêng cho mỗi ứng dụng
- ✅ Xóa App Password khi không dùng nữa
- ✅ Không share App Password với ai

### ❌ Không nên làm:

- ❌ Commit `.env` lên Git/GitHub
- ❌ Dùng password Gmail thông thường
- ❌ Share App Password qua email/chat
- ❌ Dùng chung 1 App Password cho nhiều app

---

## 📚 Tài Liệu Tham Khảo

- [Google App Passwords](https://support.google.com/accounts/answer/185833)
- [Gmail SMTP Settings](https://support.google.com/a/answer/176600)
- [Nodemailer Gmail](https://nodemailer.com/usage/using-gmail/)

---

## 🆘 Cần Trợ Giúp?

Nếu vẫn gặp vấn đề, kiểm tra:

1. Server logs trong terminal
2. Gmail inbox + Spam folder
3. File `.env` đã đúng format chưa
4. Server đã restart sau khi sửa `.env` chưa

---

**✨ Chúc bạn cấu hình thành công!**
