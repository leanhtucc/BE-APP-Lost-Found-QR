# 🛡️ GUARDIAN REPORT API – Tài liệu cho Mobile App (FE)

> **Phiên bản:** 1.0.0 · **Cập nhật:** 2026-04-24  
> **Base URL Production:** `https://your-api.com`  
> **Base URL Local:** `http://localhost:3000`

---

## Mục lục

1. [Tổng quan luồng 4 màn hình](#1-tổng-quan-luồng-4-màn-hình)
2. [Màn hình 1 – Chọn vật phẩm](#2-màn-hình-1--chọn-vật-phẩm)
3. [Màn hình 2 – Radar (FOMO count)](#3-màn-hình-2--radar-fomo-count)
4. [Màn hình 3 – Chọn vị trí mất](#4-màn-hình-3--chọn-vị-trí-mất-không-có-api-mới)
5. [Màn hình 4 – Chốt đơn & Thanh toán](#5-màn-hình-4--chốt-đơn--thanh-toán)
6. [Webhook & Sau thanh toán](#6-webhook--sau-thanh-toán)
7. [Status Dictionary](#7-status-dictionary)
8. [Error Codes](#8-error-codes)
9. [Checklist cho FE](#9-checklist-cho-fe)

---

## 1. Tổng quan luồng 4 màn hình

```
Màn hình 1              Màn hình 2              Màn hình 3              Màn hình 4
┌──────────────┐        ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ Chọn vật phẩm │──────▶│  Radar đang  │──────▶│  Chọn vị trí │──────▶│  Treo thưởng │
│  (SAFE items) │        │  hoạt động  │        │    mất đồ    │        │  & Chốt đơn  │
└──────────────┘        └──────────────┘        └──────────────┘        └──────────────┘
       │                        │                                               │
GET /v1/items/          POST /v1/radar/                                 POST /v1/reports
eligible-for-report         simulate                                   → payment_url
                                                                               │
                                                                        Mở WebView
                                                                        VNPay/MoMo
                                                                               │
                                                                    Webhook → SEARCHING
                                                                    FCM → Nearby users
```

### Headers chung (protected endpoints)

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 2. Màn hình 1 – Chọn vật phẩm

> Hiển thị danh sách đồ vật của user đang ở trạng thái **SAFE** (chưa báo mất).  
> User chọn 1 item rồi nhấn **Tiếp theo →**

### `GET /v1/items/eligible-for-report`

**Auth:** ✅ Bắt buộc

**Request:**
```
GET /v1/items/eligible-for-report
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "item_id": "clx_abc123",
        "name": "iPhone 15 Pro",
        "category": "phone",
        "image_url": "https://res.cloudinary.com/...",
        "details": {
          "color": "Titan Đen",
          "storage": "256GB",
          "serial": "48A9...XL0"
        },
        "has_insurance": true
      },
      {
        "item_id": "clx_xyz789",
        "name": "Ví da Louis Vuitton",
        "category": "wallet",
        "image_url": null,
        "details": {
          "color": null,
          "storage": null,
          "serial": null
        },
        "has_insurance": false
      }
    ]
  }
}
```

**Mapping lên UI:**

| Field trong JSON | Hiển thị trên Card |
|-------------------|--------------------|
| `name` | Tiêu đề card (VD: "iPhone 15 Pro") |
| `category` | Dòng phụ (VD: "ĐIỆN THOẠI") |
| `image_url` | Ảnh trái card |
| `details.color` + `details.storage` | Section "Chi tiết lựa chọn" |
| `details.serial` | Label S/N |
| `has_insurance` | Badge "CÓ BẢO HIỂM" màu xanh |

**Lưu vào state sau khi chọn:**
```typescript
// Cần giữ lại để truyền vào API màn 4
const selectedItemId = item.item_id; // string
```

---

## 3. Màn hình 2 – Radar (FOMO count)

> Hiển thị Modal "Radar đang hoạt động" với số người được thông báo.  
> Gọi API này **ngay khi user chuyển sang màn 2** (trước khi họ confirm).

### `POST /v1/radar/simulate`

**Auth:** ❌ Không cần

**Request:**
```json
{
  "lat": 21.0285,
  "lng": 105.8542,
  "radius": 500
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `lat` | number | Vĩ độ vị trí user |
| `lng` | number | Kinh độ vị trí user |
| `radius` | number (int) | Bán kính radar (100–5000 mét), mặc định 500 |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "active_users_count": 12,
    "recommended_radius": 500,
    "estimated_duration_hours": 24
  }
}
```

**Mapping lên UI:**

| Field | Hiển thị |
|-------|----------|
| `active_users_count` | **"12 người đã được thông báo"** (badge xanh) |
| `recommended_radius` | Section "PHẠM VI – 500m quanh bạn" |
| `estimated_duration_hours` | Section "THỜI GIAN – 24 giờ tới" |

> ⚠️ **Lưu vào state** `radar.radius` và `radar.duration_hours` để dùng ở màn 4.

---

## 4. Màn hình 3 – Chọn vị trí mất *(không có API mới)*

> User kéo map pin để xác định vị trí mất đồ.  
> FE tự xử lý bằng Google Maps / MapBox, không cần gọi API.

**Lưu vào state sau khi chọn:**
```typescript
const lostLocation = {
  lat: 21.0279,              // Float
  lng: 105.8412,             // Float
  address: "221B Baker St"   // String (reverse geocode)
};
```

---

## 5. Màn hình 4 – Chốt đơn & Thanh toán

> User chọn mức thưởng rồi nhấn **"Báo mất ngay →"**.  
> FE gọi API này, nhận `payment_url`, rồi mở **WebView** để user thanh toán.

### `POST /v1/reports`

**Auth:** ✅ Bắt buộc

**Request Body:**
```json
{
  "item_id": "clx_abc123",
  "location": {
    "lat": 21.0279,
    "lng": 105.8412,
    "address": "221B Baker St, Marylebone, London"
  },
  "radar": {
    "radius": 500,
    "duration_hours": 24
  },
  "reward": {
    "base_amount": 100000,
    "is_custom": false
  }
}
```

**Field Validation:**

| Field | Type | Bắt buộc | Giới hạn |
|-------|------|----------|---------|
| `item_id` | string | ✅ | ID lấy từ màn 1 |
| `location.lat` | number | ✅ | -90 đến 90 |
| `location.lng` | number | ✅ | -180 đến 180 |
| `location.address` | string | ❌ | Optional |
| `radar.radius` | int | ✅ | 100–5000 (mét) |
| `radar.duration_hours` | int | ✅ | 1–168 (giờ) |
| `reward.base_amount` | int | ✅ | Tối thiểu 10.000đ |
| `reward.is_custom` | boolean | ✅ | false = preset, true = tự nhập |

**Response thành công (201):**
```json
{
  "success": true,
  "data": {
    "report_id": "clx_rep999",
    "status": "PENDING_PAYMENT",
    "payment": {
      "total_to_pay": 110000,
      "payment_url": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?order_id=clx_rep999&amount=110000"
    }
  }
}
```

| Field | Mô tả |
|-------|-------|
| `report_id` | ID báo mất – lưu lại để track trạng thái |
| `status` | Luôn là `PENDING_PAYMENT` ở bước này |
| `payment.total_to_pay` | `base_amount + 10%` phí sàn |
| `payment.payment_url` | Link mở WebView thanh toán |

**Lưu vào state:**
```typescript
const reportId = data.report_id;
const paymentUrl = data.payment.payment_url;
```

### Mở WebView Thanh toán

```typescript
// React Native – mở WebView
import { WebView } from 'react-native-webview';

<WebView
  source={{ uri: paymentUrl }}
  onNavigationStateChange={(navState) => {
    // Khi URL chứa "vnpay-return" hoặc "success" → thanh toán xong
    if (navState.url.includes('vnpay-return') || navState.url.includes('payment-success')) {
      // Đóng WebView
      // Chuyển sang màn hình "Đang tìm kiếm" (Radar quay)
      navigation.replace('SearchingScreen', { reportId });
    }
    // Khi URL chứa "cancel" hoặc "fail"
    if (navState.url.includes('payment-cancel') || navState.url.includes('vnpay-fail')) {
      navigation.goBack();
      showToast('Thanh toán bị huỷ');
    }
  }}
/>
```

> 💡 Ngoài ra có thể poll `GET /v1/reports/:report_id/status` mỗi 3 giây để kiểm tra trạng thái thay vì chỉ dựa vào URL.

---

## 6. Webhook & Sau thanh toán

> **FE không cần gọi Webhook** – đây là luồng BE tự xử lý khi VNPay/MoMo gọi về.

### Luồng ngầm sau khi thanh toán thành công:

```
VNPay/MoMo
    │
    ▼
POST /api/reports/webhook/payment   ← BE xử lý tự động
    │
    ├─ Post status: PENDING_PAYMENT → SEARCHING
    ├─ Item status: PENDING_PAYMENT → LOST (lưu toạ độ mất)
    ├─ EscrowTransaction: HOLDING (tiền bị khóa an toàn)
    ├─ Push Notification → Owner: "Tiền đã được khóa an toàn"
    └─ FCM Broadcast → 12 người nearby: "Có iPhone 15 Pro vừa rơi gần bạn!"
```

### Push Notification FE sẽ nhận được (owner):

```json
{
  "title": "🔒 Escrow đã kích hoạt",
  "body": "110.000đ đã được khóa an toàn. Radar đang tìm kiếm trong bán kính 500m."
}
```

### FCM notification người dùng nearby nhận được:

```json
{
  "title": "Cảnh báo Guardian 🚨",
  "body": "Có iPhone 15 Pro vừa rơi gần bạn (0.5km). Tìm thấy nhận thưởng ngay!"
}
```

---

## 7. Status Dictionary

### Item Status

| Status | Mô tả | Hiển thị UI |
|--------|-------|-------------|
| `SAFE` | Đồ đang an toàn | Badge xanh "AN TOÀN" |
| `PENDING_PAYMENT` | Đã tạo báo mất, chờ thanh toán | Badge vàng "CHỜ THANH TOÁN" |
| `LOST` | Đang được tìm kiếm (đã thanh toán) | Badge đỏ "ĐANG TÌM" |
| `FOUND` | Người nhặt đã quét QR | Badge cam "ĐÃ TÌM THẤY" |
| `RESOLVED` | Hoàn tất – tiền thưởng đã trả | Badge xám "ĐÃ XỬ LÝ" |

### Post (Report) Status

| Status | Mô tả | Hành động FE |
|--------|-------|--------------|
| `PENDING_PAYMENT` | Chờ user thanh toán | Hiển thị nút "Thanh toán ngay" |
| `SEARCHING` | Đang tìm kiếm (radar active) | Hiển thị Radar animation |
| `FOUND` | Người nhặt đã liên hệ | Mở chat với người nhặt |
| `EXPIRED_REFUNDED` | Hết 30 ngày, đã hoàn tiền | Hiển thị thông báo hoàn tiền |
| `RESOLVED` | Hoàn tất | Badge hoàn tất |
| `CANCELLED` | Đã huỷ | Badge huỷ |

> ⚠️ **Breaking Change:** Status `ACTIVE` (cũ) → đổi thành `SEARCHING`. FE cần cập nhật tất cả nơi check `status === "ACTIVE"` sang `status === "SEARCHING"`.

---

## 8. Error Codes

### Lỗi thường gặp khi gọi `POST /v1/reports`

**409 – Item không thể báo mất:**
```json
{
  "success": false,
  "message": "Item cannot be reported: current status is LOST",
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```
→ FE hiển thị toast "Vật phẩm này đang được tìm kiếm rồi!"

**404 – Item không tồn tại:**
```json
{
  "success": false,
  "message": "Item not found",
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

**403 – Không phải chủ sở hữu:**
```json
{
  "success": false,
  "message": "You do not own this item",
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

**400 – Validation lỗi:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "reward.base_amount",
      "message": "Minimum reward is 10,000đ"
    }
  ]
}
```

**401 – Token hết hạn:**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```
→ FE gọi `POST /api/auth/refresh` để làm mới token.

---

## 9. Checklist cho FE

### ✅ Màn hình 1 – Chọn vật phẩm
- [ ] Thay `GET /api/items/my-vault` → `GET /v1/items/eligible-for-report`
- [ ] Map `item.item_id` (không phải `item.id`) vào state khi chọn
- [ ] Hiển thị `details.color`, `details.storage`, `details.serial` trong section "Chi tiết lựa chọn"
- [ ] Hiển thị badge "CÓ BẢO HIỂM" khi `has_insurance === true`

### ✅ Màn hình 2 – Radar modal
- [ ] Gọi `POST /v1/radar/simulate` với toạ độ GPS hiện tại và `radius: 500`
- [ ] Hiển thị `active_users_count` lên badge "X người đã được thông báo"
- [ ] Lưu `recommended_radius` và `estimated_duration_hours` vào state

### ✅ Màn hình 3 – Vị trí
- [ ] Lưu `{ lat, lng, address }` vào state sau khi user chọn điểm

### ✅ Màn hình 4 – Chốt đơn
- [ ] Thay `POST /api/reports/lost-item` → `POST /v1/reports`
- [ ] Body mới phải có `radar` và `reward` objects (xem format ở trên)
- [ ] Nhận `payment.payment_url` rồi mở **WebView**
- [ ] Lắng nghe `onNavigationStateChange` để detect khi thanh toán xong
- [ ] Sau thanh toán → chuyển sang màn "Đang tìm kiếm" với `report_id`

### ✅ Toàn bộ app (Breaking Change)
- [ ] Tìm tất cả `status === "ACTIVE"` → đổi thành `status === "SEARCHING"`
- [ ] Tìm tất cả `status === "ACTIVE"` trong switch/case UI → cập nhật label

### ✅ Thông báo (Notification)
- [ ] Đảm bảo FCM token đã được gửi lên server qua `PATCH /api/auth/profile` với field `pushToken`
- [ ] Handle push notification type `GUARDIAN_EXPIRED_REFUND` → hiển thị màn hoàn tiền

---

## Quick Reference – Tất cả endpoints trong luồng

| # | Màn hình | Method | Endpoint | Auth |
|---|----------|--------|----------|------|
| 1 | Chọn vật phẩm | `GET` | `/v1/items/eligible-for-report` | ✅ |
| 2 | Radar simulate | `POST` | `/v1/radar/simulate` | ❌ |
| 4 | Tạo báo mất | `POST` | `/v1/reports` | ✅ |
| - | Webhook (BE only) | `POST` | `/api/reports/webhook/payment` | ❌ (3rd party) |
| - | Huỷ báo mất | `PATCH` | `/api/items/:id/status` body `{status:"SAFE"}` | ✅ |

---

*Tài liệu này được generate từ source code thực tế. Mọi thắc mắc liên hệ team BE.*
