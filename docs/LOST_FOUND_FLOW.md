# Luồng “Nhặt được đồ” và “Đồ của tôi bị mất”

Tài liệu này là contract backend cho màn hình chọn hai nhánh trước khi người dùng báo cáo vật dụng.

## 1. Màn hình chọn nhu cầu

Frontend hiển thị hai lựa chọn:

1. **Tôi nhặt được đồ** — quét QR và liên hệ ẩn danh với chủ sở hữu.
2. **Tôi làm mất đồ** — chọn một vật dụng `SAFE` trong kho cá nhân để báo mất.

## 2. Tôi nhặt được đồ

### Quét QR

```http
GET /v1/scan/:qrCodeId
```

- `LOST`: response có `action: "open_chat"`; cho phép người nhặt tiếp tục.
- `SAFE`, `FOUND`, `RESOLVED`: response có `action: "info_only"`; không tạo finder mới.

### Xác nhận đã nhặt được và mở chat

```http
POST /v1/scan/guest-init
Content-Type: application/json
```

```json
{
  "itemId": "qr-code-id",
  "phoneNumber": "+84901234567",
  "lat": 10.7769,
  "lng": 106.7009
}
```

`lat` và `lng` là tùy chọn nhưng phải được gửi cùng nhau. Backend chuyển item `LOST → FOUND`, chuyển Guardian report đang `ACTIVE → FOUND`, tạo phòng chat và thông báo cho chủ sở hữu. Nếu một finder khác đã nhận trước, API trả `409 ITEM_ALREADY_FOUND`.

## 3. Tôi làm mất đồ

### Lấy kho đồ có thể báo mất

```http
GET /v1/items/eligible-for-report
Authorization: Bearer <token>
```

API chỉ trả vật dụng thuộc người dùng, đang `SAFE` và chưa có Guardian report `PENDING_PAYMENT` hoặc `ACTIVE`.

Mỗi item có cả `id` và `item_id` cùng giá trị trong giai đoạn tương thích. Frontend mới nên dùng `item_id`.

### Cách A — Báo mất không dùng Guardian thanh toán

```http
PATCH /v1/items/:itemId/status
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "status": "LOST",
  "lostMessage": "Đánh rơi gần cổng trường",
  "lostAddress": "Cổng trường Nguyễn Du",
  "latitude": 10.7769,
  "longitude": 106.7009
}
```

Backend chỉ cho phép `SAFE → LOST`, lưu vị trí mất và phát sự kiện radar. Nếu item không còn đủ điều kiện, API trả `409 ITEM_NOT_ELIGIBLE`.

Để hủy báo mất và đưa đồ về kho an toàn:

```json
{
  "status": "SAFE"
}
```

Backend xóa thông tin vị trí mất hiện hành và hủy Guardian report/escrow đang mở nếu có.

### Cách B — Báo mất có Guardian và thanh toán

Frontend lấy `item_id` từ API trên rồi gọi `POST /v1/reports`. Item vẫn là `SAFE` trong lúc report `PENDING_PAYMENT`. Chỉ sau khi webhook thanh toán hợp lệ, backend mới chuyển item `SAFE → LOST`, lưu đủ vị trí địa lý và phát sự kiện radar.

Hai cách không thể chạy đồng thời cho cùng một item.

## 4. Quyền thay đổi trạng thái

Client chỉ được gửi `SAFE` hoặc `LOST` qua endpoint status. Các trạng thái sau do backend quản lý:

- `FOUND`: một finder đã xác nhận và bắt đầu liên hệ.
- `RESOLVED`: chủ sở hữu hoàn tất trao trả/thanh toán.

Các endpoint cũ dưới `/api` vẫn hoạt động; frontend mới nên dùng contract `/v1`.
