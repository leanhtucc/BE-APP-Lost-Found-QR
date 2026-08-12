# Hướng dẫn sử dụng Logo trong Email Templates

## 📁 Cấu trúc thư mục

```
backend-basic/
├── public/                    # Thư mục static assets (mới tạo)
│   ├── assets/
│   │   └── images/
│   │       └── email/
│   │           ├── logo-email.png       # Logo chính cho email
│   │           ├── logo-light.png       # Logo nền sáng (optional)
│   │           └── logo-dark.png        # Logo nền tối (optional)
│   └── README.md
├── src/
│   ├── utils/
│   │   ├── asset.ts          # Utility xử lý assets (mới tạo)
│   │   └── template.ts       # Template engine (đã update)
│   └── templates/
│       └── emails/
│           ├── verification.html
│           └── welcome.html
```

## 🎨 Chuẩn bị Logo

### Kích thước khuyến nghị:
- **Logo email**: 200x200px hoặc 400x400px (Retina)
- **Format**: PNG với nền trong suốt
- **Kích thước file**: < 50KB (để email load nhanh)

### Đặt logo vào đúng vị trí:

```bash
# Copy logo của bạn vào:
public/assets/images/email/logo-email.png
```

## 🔧 Cách sử dụng

### Option 1: URL Image (External Link)

**Ưu điểm**: Giảm kích thước email, dễ update logo
**Nhược điểm**: Cần server accessible, một số email client block external images

Trong template HTML:
```html
<img src="{{logoUrl}}" alt="Lost & Found Logo" width="80" height="80">
```

Trong code:
```typescript
const html = TemplateUtil.loadAndRender("verification", {
  displayName: "John",
  code: "123456",
  year: 2026,
  // logoUrl sẽ tự động được thêm: http://localhost:3000/public/assets/images/email/logo-email.png
}, {
  useBase64Images: false, // Use URL
  baseUrl: "https://your-domain.com" // Production URL
});
```

### Option 2: Base64 Embedded (Recommended cho Email)

**Ưu điểm**: Luôn hiển thị, không bị block
**Nhược điểm**: Tăng kích thước email

Trong code:
```typescript
const html = TemplateUtil.loadAndRender("verification", {
  displayName: "John",
  code: "123456",
  year: 2026,
}, {
  useBase64Images: true // Logo sẽ được embed as base64
});
```

## 📝 Update Email Templates

### Verification Template

Thay thế phần logo hiện tại:

```html
<!-- Thay vì emoji -->
<div class="logo">🔍</div>

<!-- Dùng logo image -->
<div class="logo">
  <img src="{{logoUrl}}" alt="Lost & Found" style="width: 100%; height: 100%; object-fit: contain;">
</div>
```

### Welcome Template

Tương tự:

```html
<div class="logo">
  <img src="{{logoUrl}}" alt="Lost & Found" style="width: 100%; height: 100%; object-fit: contain;">
</div>
```

## 🚀 Test Logo

### 1. Đặt logo vào public/assets/images/email/
### 2. Update templates (thay emoji bằng `<img src="{{logoUrl}}">`)
### 3. Test:

```typescript
// Test trong auth.service.ts
const html = TemplateUtil.loadAndRender("verification", {
  displayName: "Test User",
  code: "123456",
  year: new Date().getFullYear(),
}, {
  useBase64Images: true // Hoặc false để dùng URL
});

console.log(html); // Kiểm tra logo đã được inject
```

## 🌐 Production Setup

Thêm biến môi trường trong `.env`:

```env
# App URL (cho logo URL)
APP_URL=https://api.lostandfound.com
```

## ⚡ Performance Tips

1. **Nén logo**: Dùng TinyPNG để giảm kích thước
2. **CDN**: Upload logo lên CDN (Cloudinary, AWS S3)
3. **Lazy load**: Email client tự động lazy load images
4. **Fallback**: Giữ emoji làm fallback nếu logo không load được

## 🎯 AssetUtil API

```typescript
import { AssetUtil } from "./utils/asset";

// Get logo URL
const url = AssetUtil.getEmailLogo("default", "https://your-domain.com");
// => https://your-domain.com/public/assets/images/email/logo-email.png

// Get base64
const base64 = AssetUtil.getEmailLogoBase64("default");
// => data:image/png;base64,iVBORw0KG...

// Check if exists
const exists = AssetUtil.exists("images/email/logo-email.png");

// Custom image
const customUrl = AssetUtil.getAssetUrl("images/banner.jpg");
const customBase64 = AssetUtil.imageToBase64("images/icon.png");
```
