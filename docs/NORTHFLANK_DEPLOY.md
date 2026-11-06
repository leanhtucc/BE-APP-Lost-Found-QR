# Deploy backend lên Northflank

Project `lostfound-api` · service `be-app-lost-found-qr` · build bằng `Dockerfile` trong repo.

## 1. Cấu hình service (một lần)

| Mục | Giá trị |
|---|---|
| Source | Repo GitHub `leanhtucc/BE-APP-Lost-Found-QR`, nhánh deploy của bạn |
| Build | **Dockerfile**, context `/`, đường dẫn `/Dockerfile` |
| Port | **3000**, giao thức **HTTP**, bật **Public** (Northflank cấp domain HTTPS) |
| Số instance | **1** (rate-limit nằm trong bộ nhớ và Socket.IO chưa dùng adapter chia sẻ; tăng instance chỉ khi đã có Redis) |
| Tài nguyên | tối thiểu 0.5 vCPU / 512 MB RAM |
| Health check (liveness) | HTTP `GET /health/live`, port 3000 |
| Health check (readiness) | HTTP `GET /health/ready`, port 3000 (trả 503 nếu mất kết nối DB) |
| Lệnh chạy | để trống (dùng `CMD` của Dockerfile: `sh entrypoint.sh`) |

Dockerfile đã tự `prisma generate` và `npm run build`. Server nghe `0.0.0.0:$PORT`.

## 2. Biến môi trường

Tạo **Secret group** `backend-prod`, gắn vào service. Giá trị bí mật bạn tự nhập trên Northflank, không commit vào git.

### Bắt buộc (thiếu là server không khởi động)
| Biến | Giá trị / cách tạo |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | Chuỗi kết nối Supabase dạng **pooler** (IPv4). Không dùng host trực tiếp `db.<ref>.supabase.co` vì chỉ có IPv6 |
| `DIRECT_URL` | Chuỗi **session pooler** (cổng 5432) dùng cho `prisma migrate` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32`, khác `JWT_SECRET` |
| `GUEST_JWT_SECRET` | `openssl rand -hex 32`, khác hai khóa trên |
| `HANDOVER_CODE_SALT` | `openssl rand -hex 32`, khác cả ba khóa trên (mới, bắt buộc ở production) |

### Cần để các tính năng chạy
| Nhóm | Biến |
|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (bắt đầu `sb_publishable_`), `SUPABASE_SECRET_KEY` (bắt đầu `sb_secret_`), `SUPABASE_JWKS_URL`, `SUPABASE_STORAGE_BUCKET` (`item-images`) |
| Chat | `STREAM_API_KEY`, `STREAM_API_SECRET`, tuỳ chọn `STREAM_TOKEN_TTL_SECONDS` (mặc định 3600) |
| Push (FCM) | `FIREBASE_SERVICE_ACCOUNT_JSON` = **toàn bộ nội dung** file service account (dán vào Secret). Hoặc bộ ba `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Google đăng nhập | `GOOGLE_CLIENT_ID`, `GOOGLE_ALLOWED_CLIENT_IDS` (cách nhau dấu phẩy: Web + Android), `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| URL công khai | `APP_BASE_URL` = domain HTTPS Northflank của service, `APP_URL` giống vậy, `FRONTEND_URL` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `EMAIL_FROM` |
| AI / bản đồ | `GOOGLE_API_KEY` hoặc `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `AI_MODEL` |
| Proxy | `TRUST_PROXY_HOPS=1` (mặc định ở production; Northflank đứng trước app nên cần giữ để rate-limit lấy đúng IP) |
| CORS | `CORS_ORIGINS` — app mobile không gửi header Origin nên không cần; chỉ điền nếu có web client |
| Redis (tuỳ chọn) | `REDIS_URL` hoặc `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| Thanh toán (chỉ khi bật thưởng) | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL` |

Không đặt `SKIP_EMAIL_VERIFICATION=true` ở production.

## 3. Migration database

Entrypoint chỉ chạy `prisma migrate deploy` khi `RUN_MIGRATIONS=true`.

1. Lần deploy đầu (hoặc khi có migration mới): đặt `RUN_MIGRATIONS=true`, deploy, xem log thấy
   `Running Database Migrations...` rồi `Starting server...`.
2. Sau khi chạy xong, đổi `RUN_MIGRATIONS` thành `false` (hoặc xoá) để các lần khởi động lại không đụng schema.

Lệnh này chỉ áp các migration **đã có** trong `prisma/migrations`, không tạo migration mới. Nên sao lưu database trước khi chạy lần đầu trên dữ liệu thật.

## 4. Kiểm tra sau deploy

```bash
curl -i https://<domain-northflank>/health/live    # 200 {"status":"alive"}
curl -i https://<domain-northflank>/health/ready   # 200 {"database":"connected"}
```

Nếu `/health/ready` trả 503: kiểm tra `DATABASE_URL` (phải là pooler IPv4, có `sslmode`) và log của service.

## 5. Nối app mobile

Đặt `API_URL=https://<domain-northflank>` (không có dấu `/` cuối) trong biến môi trường EAS cho profile `preview`/`production`. Production không được trỏ về localhost hay IP LAN.

## 6. Lỗi thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| Crash ngay: `HANDOVER_CODE_SALT is required in production` | Chưa đặt biến, hoặc ngắn hơn 32 ký tự |
| Crash: `GUEST_JWT_SECRET is required in production` | Chưa đặt biến |
| Crash: `... must be distinct from ...` | Hai khóa trùng giá trị |
| Crash: lỗi zod ở `SUPABASE_*` | Khóa sai tiền tố (`sb_publishable_`, `sb_secret_`) |
| 503 ở `/health/ready` | Sai chuỗi DB hoặc dùng host IPv6 |
| Mọi người dùng bị `429` | `TRUST_PROXY_HOPS` bị đặt `0` nên mọi request cùng một IP (mặc định ở production đã là 1) |
| Không nhận push | Thiếu hoặc sai `FIREBASE_SERVICE_ACCOUNT_JSON` |
