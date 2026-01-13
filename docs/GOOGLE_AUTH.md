# Google OAuth Authentication

Hướng dẫn sử dụng đăng nhập bằng Google cho Lost & Found API.

## 📋 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Setup Google OAuth](#setup-google-oauth)
3. [Cấu hình môi trường](#cấu-hình-môi-trường)
4. [Flow hoạt động](#flow-hoạt-động)
5. [API Endpoints](#api-endpoints)
6. [Test trong development](#test-trong-development)
7. [Xử lý lỗi](#xử-lý-lỗi)

## 🎯 Tổng quan

Google OAuth cho phép người dùng đăng nhập vào hệ thống bằng tài khoản Google của họ mà không cần tạo password riêng. Tính năng này:

- ✅ Tự động xác thực email (không cần gửi mã verification)
- ✅ Lấy thông tin cơ bản từ Google (tên, email, ảnh đại diện)
- ✅ Tạo tài khoản mới hoặc link với tài khoản hiện có
- ✅ Trả về JWT tokens để sử dụng API

## 🔧 Setup Google OAuth

### Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project có sẵn
3. Enable **Google+ API**:
   - Vào **APIs & Services** > **Library**
   - Tìm "Google+ API" và click **Enable**

### Bước 2: Tạo OAuth 2.0 Credentials

1. Vào **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Chọn **Application type**: Web application
4. Điền thông tin:
   - **Name**: Lost & Found Backend
   - **Authorized JavaScript origins**:

     ```
     http://localhost:3000
     ```

   - **Authorized redirect URIs**:

     ```
     http://localhost:3000/api/auth/google/callback
     ```

5. Click **Create**
6. Copy **Client ID** và **Client Secret**

### Bước 3: Configure OAuth Consent Screen

1. Vào **OAuth consent screen**
2. Chọn **External** (cho testing)
3. Điền thông tin cơ bản:
   - **App name**: Lost & Found
   - **User support email**: <your-email@gmail.com>
   - **Developer contact**: <your-email@gmail.com>
4. **Scopes**: Thêm các scopes sau
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
5. **Test users**: Thêm email của bạn để test
6. Click **Save and Continue**

## ⚙️ Cấu hình môi trường

Thêm vào file `.env`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# App Base URL (cho production)
APP_BASE_URL=http://localhost:3000
```

**Lưu ý**: Không commit Client Secret vào Git!

## 🔄 Flow hoạt động

```
┌─────────┐           ┌──────────┐           ┌────────────┐           ┌─────────┐
│ Client  │           │ Backend  │           │   Google   │           │Database │
└────┬────┘           └─────┬────┘           └──────┬─────┘           └────┬────┘
     │                      │                       │                      │
     │  1. GET /auth/google │                       │                      │
     ├─────────────────────>│                       │                      │
     │                      │                       │                      │
     │  2. Redirect to      │                       │                      │
     │     Google OAuth URL │                       │                      │
     │<─────────────────────┤                       │                      │
     │                      │                       │                      │
     │  3. User login & consent                     │                      │
     ├─────────────────────────────────────────────>│                      │
     │                      │                       │                      │
     │  4. Redirect with code                       │                      │
     │     /callback?code=xxx                       │                      │
     │<─────────────────────────────────────────────┤                      │
     │                      │                       │                      │
     │  5. GET /callback?code=xxx                   │                      │
     ├─────────────────────>│                       │                      │
     │                      │                       │                      │
     │                      │  6. Verify token      │                      │
     │                      ├──────────────────────>│                      │
     │                      │                       │                      │
     │                      │  7. User info         │                      │
     │                      │<──────────────────────┤                      │
     │                      │                       │                      │
     │                      │  8. Check/Create user │                      │
     │                      ├──────────────────────────────────────────────>│
     │                      │                       │                      │
     │                      │  9. User data         │                      │
     │                      │<──────────────────────────────────────────────┤
     │                      │                       │                      │
     │  10. JWT tokens +    │                       │                      │
     │      user info       │                       │                      │
     │<─────────────────────┤                       │                      │
     │                      │                       │                      │
```

### Chi tiết các bước

1. **Client request**: User click "Login with Google" → Frontend gọi `GET /api/auth/google`
2. **Redirect**: Backend tạo Google OAuth URL và redirect user đến Google
3. **Google login**: User đăng nhập Google và cho phép quyền truy cập
4. **Callback**: Google redirect về backend với authorization code
5. **Backend receive**: Backend nhận code từ query params
6. **Verify token**: Backend exchange code với Google để lấy ID token
7. **Get user info**: Google trả về thông tin user (email, name, picture)
8. **Check database**: Backend kiểm tra user đã tồn tại chưa
   - Nếu có `googleId`: Login existing user
   - Nếu có `email` (không có googleId): Link Google account
   - Nếu không tồn tại: Tạo user mới
9. **Generate JWT**: Tạo access token và refresh token
10. **Response**: Trả về tokens và user info cho client

## 🔗 API Endpoints

### 1. Bắt đầu Google OAuth

```http
GET /api/auth/google
```

**Response**: HTTP 302 Redirect đến Google consent screen

**Ví dụ**:

```bash
curl -L http://localhost:3000/api/auth/google
```

### 2. Callback từ Google (Automatic)

```http
GET /api/auth/google/callback?code=xxx
```

**Query Parameters**:

- `code` (string, required): Authorization code từ Google

**Response 200 OK**:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clx1234567890",
      "uid": "user_abc123def456",
      "email": "user@gmail.com",
      "displayName": "John Doe",
      "photoURL": "https://lh3.googleusercontent.com/...",
      "isVerified": true
    },
    "isNewUser": true
  },
  "message": "Account created successfully"
}
```

**Response Fields**:

- `accessToken`: JWT token để gọi protected APIs (expires: 7 days)
- `refreshToken`: Token để refresh access token (expires: 30 days)
- `user`: Thông tin user
- `isNewUser`: `true` nếu tạo tài khoản mới, `false` nếu login tài khoản có sẵn

## 🧪 Test trong development

### Option 1: Dùng Browser

1. Start server:

```bash
npm run dev
```

1. Mở browser và truy cập:

```
http://localhost:3000/api/auth/google
```

1. Login bằng Google account
2. Sau khi callback, copy accessToken từ response
3. Dùng token để test các API khác:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3000/api/auth/profile
```

### Option 2: Dùng Frontend

**React/Next.js Example**:

```javascript
// Login button
const handleGoogleLogin = () => {
  window.location.href = "http://localhost:3000/api/auth/google";
};

// Callback page (pages/auth/callback.tsx)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    // Code sẽ tự động được xử lý bởi backend
    // Backend sẽ trả về JSON response
  }
}, []);
```

**Vue.js Example**:

```javascript
methods: {
  loginWithGoogle() {
    window.location.href = 'http://localhost:3000/api/auth/google';
  }
}
```

### Option 3: Test với Postman/Thunder Client

1. Tạo request `GET http://localhost:3000/api/auth/google`
2. Trong settings, enable "Automatically follow redirects"
3. Send request
4. Login bằng Google khi được redirect
5. Postman sẽ tự động follow redirect về callback
6. Xem response JSON với tokens

## 🚨 Xử lý lỗi

### Lỗi thường gặp

**1. "Authorization code is required"**

```json
{
  "success": false,
  "message": "Authorization code is required"
}
```

**Nguyên nhân**: Callback không có code parameter
**Giải pháp**: Kiểm tra redirect URI trong Google Console

---

**2. "Google email not verified"**

```json
{
  "success": false,
  "message": "Google email not verified"
}
```

**Nguyên nhân**: Email Google chưa được verify
**Giải pháp**: User cần verify email trên Google account

---

**3. "Google authentication failed"**

```json
{
  "success": false,
  "message": "Google authentication failed"
}
```

**Nguyên nhân**:

- Client ID/Secret sai
- Authorization code đã hết hạn (10 phút)
- Network error

**Giải pháp**:

- Kiểm tra lại credentials trong `.env`
- User thử login lại
- Check logs để xem chi tiết lỗi

---

**4. Redirect URI mismatch**

Lỗi này xuất hiện trên trang Google:

```
Error: redirect_uri_mismatch
```

**Giải pháp**:

1. Vào Google Cloud Console
2. Credentials → Edit OAuth client
3. Thêm chính xác URL:

   ```
   http://localhost:3000/api/auth/google/callback
   ```

4. Save và thử lại (có thể mất vài phút để update)

## 🔐 Security Best Practices

1. **Không commit secrets**:
   - Thêm `.env` vào `.gitignore`
   - Dùng environment variables cho production

2. **Validate Google ID token**:
   - Code đã tự động verify signature của Google
   - Check `verified_email` phải là `true`

3. **HTTPS trong production**:
   - Bắt buộc dùng HTTPS cho callback URL
   - Update `GOOGLE_CALLBACK_URL` trong production

4. **Rate limiting**:
   - Backend đã có rate limiting middleware
   - Giới hạn số lần thử login

5. **Token expiration**:
   - Access token: 7 days
   - Refresh token: 30 days
   - Client nên implement auto-refresh

## 📱 Production Deployment

### Update Environment Variables

```env
# Production
GOOGLE_CLIENT_ID=your-prod-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-prod-client-secret
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
APP_BASE_URL=https://api.yourdomain.com
```

### Update Google Console

1. Thêm production URLs vào **Authorized redirect URIs**:

   ```
   https://api.yourdomain.com/api/auth/google/callback
   ```

2. Thêm production domain vào **Authorized JavaScript origins**:

   ```
   https://api.yourdomain.com
   https://yourdomain.com
   ```

3. Publish app (OAuth consent screen):
   - Change from "Testing" to "In production"
   - Submit for verification nếu cần

## 🆘 Troubleshooting

### Debug mode

Bật logs để debug:

```typescript
// src/libs/google-oauth.ts
console.log("Google OAuth response:", googleUser);
```

### Check database

Xem user đã được tạo chưa:

```bash
npx prisma studio
```

Kiểm tra:

- User có `googleId` không
- Email có match không
- `isVerified` phải là `true`

## 📚 Tài liệu tham khảo

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Google Sign-In](https://developers.google.com/identity/sign-in/web)
- [googleapis NPM](https://www.npmjs.com/package/googleapis)

## 🤝 Support

Nếu gặp vấn đề, hãy:

1. Check logs trong terminal
2. Xem file `.env` đã đúng chưa
3. Verify Google Console settings
4. Test với Google account đã verify email
