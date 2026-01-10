# Public Assets

Thư mục này chứa các file tĩnh (static files) như hình ảnh, logo, icons, v.v.

## Cấu trúc

```
public/
├── assets/
│   ├── images/          # Hình ảnh, logo
│   │   ├── logo.png     # Logo chính
│   │   ├── logo-light.png
│   │   ├── logo-dark.png
│   │   └── email/       # Logo cho email templates
│   │       ├── logo-email.png
│   │       └── icon.png
│   ├── icons/           # Icons, favicons
│   └── qr-codes/        # QR codes được generate
```

## Sử dụng

Các file trong thư mục `public/` được serve tĩnh qua Express:

```typescript
// Trong app.ts
app.use('/public', express.static('public'));
```

Truy cập: `http://localhost:3000/public/assets/images/logo.png`

## Logo cho Email

Để sử dụng logo trong email templates:

### Option 1: Sử dụng URL (Recommended)
```html
<img src="https://your-domain.com/public/assets/images/email/logo-email.png" alt="Logo">
```

### Option 2: Base64 Embed
```html
<img src="data:image/png;base64,iVBORw0KG..." alt="Logo">
```

## Best Practices

1. **Tối ưu kích thước**: Logo email nên < 50KB
2. **Format**: PNG với nền trong suốt
3. **Kích thước**: 200x200px cho logo email
4. **Hosting**: Nên host trên CDN hoặc server riêng
